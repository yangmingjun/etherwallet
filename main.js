const readline = require('readline');
const colors = require('colors');
const fs = require('fs');
const request = require('sync-request');
const ethUtil = require('ethereumjs-util');
const ethUnits = require('ethereumjs-units');
const ethWallet = require('ethereumjs-wallet');
const ethTx = require('ethereumjs-tx');
const config = require('./config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var steps = {};

//入口
steps.entrance = function(){
  return {
    'before': () => {
      console.log('键入数字进入下一步');
      console.log('1、ETH转账');
      console.log('2、创建钱包');
      console.log('3、导入钱包');
    },
    'after': (answer) => {
      switch(answer){
        case '1':
          return steps.ethSend();
        case '2':
          return steps.walletCreate();
        case '3':
          return steps.walletImport();
        default:
          return steps.entrance();
      }
    }
  };
};

//创建钱包
steps.walletCreate = function(){
  return function(){
    console.log('正在开发中，敬请期待' . green);
    return steps.entrance();
  };
};

//导入钱包
steps.walletImport = function(){
  return function(){
    console.log('正在开发中，敬请期待' . green);
    return steps.entrance();
  };
};

//ETH转账
steps.ethSend = function(){
  //keystore文件列表
  var keystoreFiles = [];

  //keystoreContent
  var keystoreContent = '';

  //钱包
  var wallet;

  //当前余额
  var balance;

  //转账地址
  var receiptAddress;

  //转账金额
  var amount;

  //转账手续费
  var gasLimit;
  var gasPrice;
  var fee;

  //选择钱包使用类型
  var step1 = {
    'before': () => {
      console.log('键入数字进入下一步');
      console.log('1、选择keystore文件夹中钱包');
      console.log('2、粘贴keystore内容');
      console.log('3、粘贴私钥');
    },
    'after': (answer) => {
      switch(answer){
        case '1':
          var fileList = fs.readdirSync('./keystore');
          keystoreFiles = [];
          for(let i = 0; i < fileList.length; i++){
            let matchItem = fileList[i].match(/[0-9a-fA-F]{40}/);
            if(!matchItem){
              continue;
            }
            keystoreFiles.push({
              'address': ethUtil.toChecksumAddress(matchItem[0]),
              'file': fileList[i]
            });
          }
          if(keystoreFiles.length == 0){
            console.log('keystore文件夹中没有可用钱包' . red);
            return step1;
          }
          return step2_1;
        case '2':
          return step2_2;
          break;
        case '3':
          return step2_3;
          break;
        default:
          return ;
      }
    }
  };

  //选择keystore文件夹中钱包
  var step2_1 = {
    'before': () => {
      console.log('键入数字选择你要操作的钱包');
      for(let i = 0; i < keystoreFiles.length; i++){
        console.log((i + 1) + '、' +  keystoreFiles[i].address);
      }
    },
    'after': (answer) => {
      var index = parseInt(answer);
      //错误参数
      if(isNaN(index) || index <= 0 || index > keystoreFiles.length){
        return setp2_1;
      }
      //获取keystore文件内容
      keystoreContent = fs.readFileSync('./keystore/' + keystoreFiles[index - 1].file, 'utf-8');
      return step4;
    }
  };

  //粘贴keystore内容
  var step2_2 = {
    'before': () => {
      console.log('粘贴或输入keystore内容');
    },
    'after': (answer) => {
      keystoreContent = answer.trim();
      return step4;
    }
  };

  //粘贴私钥
  var step2_3 = {
    'before': () => {
      console.log('粘贴或输入钱包私钥');
    },
    'after': (answer) => {
      try {
        wallet = ethWallet.fromPrivateKey(Buffer.from(answer.trim(), 'hex'));
      } catch (error) {
        console.log('私钥错误！' . red);
        return step2_3;
      }

      return step5;
    }
  };

  //输入keystore密码解密
  var step4 = {
    'before': () => {
      console.log('输入keystore密码解锁钱包');
    },
    'after': (answer) => {
      try {
        wallet = ethWallet.fromV3(keystoreContent.toLowerCase(), answer);
      } catch (error) {
        console.log('密码错误！' . red);
        return step4;
      }

      return step5;
    }
  }

  //查询余额
  var step5 = function(){
    var address = ethUtil.bufferToHex(wallet.getAddress());
    var url = 'https://api.etherscan.io/api?module=account&action=balance&address=' + address + '&tag=pending&apikey=' + config.etherscan.apikey;
    console.log('正在查询' + ethUtil.bufferToHex(wallet.getAddress()) + '余额...');
    balance = requestGet(url);
    if(!balance){
      console.log('查询失败');
      return step5;
    }
    console.log('当前余额: ' + ethUnits.convert(balance, 'wei', 'eth') + ' ETH');
    return step6;
  };

  //设置转账地址
  var step6 = {
    'before': () => {
      console.log('粘贴或输入转账地址');
    },
    'after': (answer) => {
      receiptAddress = answer.trim();
      if(!/^0x[0-9a-fA-F]{40}$/.test(receiptAddress)){
        console.log('转账地址错误' . red);
        return step6;
      }
      return step7;
    }
  };

  //输入gas price
  var step7 = {
    'before': () => {
      console.log('输入Gas Price，留空默认10 Gwei');
    },
    'after': (answer) => {
      var gasBN;
      var gasPriceBN;
      answer = answer.trim();

      gasLimit = '21000';
      gasBN = new ethUtil.BN(gasLimit);

      if(answer === ''){
        // 10 gwei
        gasPrice = '10000000000';
        gasPriceBN = new ethUtil.BN(gasPrice);
      }else{
        if(!/^\d{1,3}$/.test(answer)){
          console.log('Gas Price错误' . red);
          return step7;
        }
        gasPriceBN = new ethUtil.BN('1000000000').mul(new ethUtil.BN(answer));
        gasPrice = gasPriceBN.toString(10);
      }
      fee = gasBN.mul(gasPriceBN).toString(10);
      return step8;
    }
  };

  //输入转账金额
  var step8 = {
    'before': () => {
      console.log('输入转账金额，留空默认全部转走');
    },
    'after': (answer) => {
      answer = answer.trim();
      if(answer === ''){
        if(new ethUtil.BN(balance).cmp(new ethUtil.BN(fee)) === -1){
          console.log('账户余额不足以支付矿工费' . red);
          //重新设置gas price
          return step7;
        }
        amount = new ethUtil.BN(balance).sub(new ethUtil.BN(fee)).toString(10);
      }else{
        if(!/^\d+(\.\d+)?$/.test(answer)){
          console.log('转账金额错误' . red);
          return step8;
        }
        amount = Units.convert(answer, 'eth', 'wei');
        if(new ethUtil.BN(balance).sub(new ethUtil.BN(fee)).cmp(new ethUtil.BN(amount)) === -1){
          console.log('账户余额不足' . red);
          //重新输入转账金额
          return step8;
        }
      }
      return step9;
    }
  };

  //是否确认转账
  var step9 = {
    'before': () => {
      console.log('请确认转账信息');
      console.log('付款地址: ' + ethUtil.bufferToHex(wallet.getAddress()));
      console.log('收款地址: ' + receiptAddress);
      console.log('转账金额: ' + ethUnits.convert(amount, 'wei', 'eth') + ' ETH');
      console.log('  矿工费: ' + ethUnits.convert(fee, 'wei', 'eth')  + ' ETH');
      console.log('是否确认转账？yes or no');
    },
    'after': (answer) => {
      answer = answer.toLowerCase();
      if(answer == 'n' || answer == 'no'){
        //重新输入转账地址
        return step6;
      }
      if(answer != 'y' && answer != 'yes'){
        return step9;
      }

      console.log('正在获取nonce值...');
      var nonce = requestGet(
        'https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=' 
        + ethUtil.bufferToHex(wallet.getAddress()) 
        + '&tag=pending&apikey=' 
        + config.etherscan.apikey
      );
      if(!nonce){
        console.log('获取nonce值失败' . red);
        return step9;
      }

      console.log('正在生成交易数据...');
      var tx = new ethTx({
        to: receiptAddress,
        nonce: nonce,
        gasPrice: '0x' + new ethUtil.BN(gasPrice).toString(16),
        gasLimit: '0x' + new ethUtil.BN(gasLimit).toString(16),
        value: '0x' + new ethUtil.BN(amount).toString(16)
      });
      tx.sign(wallet.getPrivateKey());
      var serializedTx = tx.serialize();
      var transactionData = '0x' + serializedTx.toString('hex');

      console.log('正在通过etherscan广播交易...');
      var res = requestGet(
        'https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction'
        + '&hex=' + transactionData
        + '&apikey=' + config.etherscan.apikey
      );
      console.log('HashID: ' + ethUtil.bufferToHex(ethUtil.sha3(transactionData)));
      if(!res){
        console.log('广播交易或许失败了！' . red);
      }else{
        console.log('广播交易成功！' . green);
      }
      console.log('明细[成功/失败]可通过etherscan查询');
      return step10;
    }
  };

  //转账成功
  var step10 = {
    'before': () => {
      console.log('键入数字进入下一步');
      console.log('1、继续使用此钱包进行转账');
      console.log('2、返回');
    },
    'after': (answer) => {
      switch(answer){
        case '1':
          return step5;
        case '2':
          return steps.entrance();
        default:
          return step10;
      }
    }
  };

  //重试
  var retry = function(retryStep, skipStep, tip){
    return {
      'before': () => {
        console.log(tip || '是否重新尝试？yes or no');
      },
      'after': (answer) => {
        answer = answer.toLowerCase();
        if(answer == 'n' || answer == 'no'){
          return skipStep;
        }
        if(answer != 'y' && answer != 'yes'){
          return retry(retryStep, skipStep, tip);
        }
        return retryStep;
      }
    }
  };

  return step1;
}

function requestGet(url){
  var res = request('GET', url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.119 Safari/537.36'
    }
  });
  var body = res.getBody('utf-8');

  console.log(body);

  try {
    var bodyObj = JSON.parse(body);
    if(!bodyObj.result){
      return false;
    }
    return bodyObj.result;
  } catch (error) {
    return false;
  }
}

function requestPost(url, data){
  var body = '';
  var params = [];
  if(data){
    for (let key in data) {
      params.push(key + '=' + data[key]);
    }
    body = params.join('&');
  }
  var res = request('POST', url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.119 Safari/537.36'
    },
    body: body
  });
  var resBody = res.getBody('utf-8');

  console.log(body);
  console.log(resBody);

  try {
    var bodyObj = JSON.parse(resBody);
    if(!bodyObj.result){
      return false;
    }
    return bodyObj.result;
  } catch (error) {
    return false;
  }
}

function handle(step){
  if(typeof step == 'function'){
    handle(step());
  }else{
    if(typeof step.before == 'function'){
      step.before();
    }
    rl.write(null, {ctrl: true, name: 'u' });
    rl.question('>>> ', (answer) => {
      rl.pause();
      var next = step;
      if(answer.toLowerCase() == 'exit'){
        console.log('已关闭etherwallet');
        rl.close();
        process.exit(1);
      }
      if(answer.toLowerCase() == 'home'){
        handle(steps.entrance());
        return ;
      }
      if(typeof step.after != 'function'){
        console.log('程序错误，强制退出');
        rl.close();
        process.exit(1);
      }
      next = step.after(answer);
      if(next){
        handle(next);
      }else{
        console.log('程序错误，强制退出');
        rl.close();
        process.exit(1);
      }
    });
  }
}

handle(steps.entrance());