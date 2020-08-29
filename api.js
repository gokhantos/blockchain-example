var express = require('express');
var app = express();

const Blockchain = require('./blockchain');
const bitcoin = new Blockchain();
const nodeAddress = guid();
const port = process.argv[2];
const rp = require('request-promise');

app.use(express.json());

app.get('/blockchain', function(req, res){
    res.send(bitcoin);
});

app.post('/transaction', function(req, res){
    const newTransaction = req.body;
    const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
    res.json({note: `Transaction will be added in block ${blockIndex}.`});
});

app.post('/transaction/broadcast', function(req, res){
  const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
  const requestPromises = [];
  bitcoin.networkNodes.forEach(networkNodeURL => {
    const requestOptions = {
      uri: networkNodeURL + '/transaction',
      method: 'POST',
      body: newTransaction,
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises)
	.then(data => {
		res.json({ note: 'Transaction created and broadcast successfully.' });
  })
  .catch(function(){
    console.log('Promise rejected. 1');
  });
});

app.get('/mine', function(req, res){
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    
    const currentBlockData = {
		transactions: bitcoin.pendingTransactions,
		index: lastBlock['index'] + 1
    };
    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);
    const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);
    
    const requestPromises = [];
    
    bitcoin.networkNodes.forEach(networkNodeURL => {
      const requestOptions = {
        uri: networkNodeURL + '/recieve-new-block',
        method: 'POST',
        body: { newBlock: newBlock},
        json: true
      };
      requestPromises.push(rp(requestOptions));
    });
    
    Promise.all(requestPromises).then(data =>{
      //mining reward 12.5 bitcoin
      const requestOptions = {
        uri: bitcoin.currentNodeURL + '/transaction/broadcast',
        method: 'POST',
        body: {
          amount: 12.5,
          sender: "00",
          recipient: nodeAddress
        },
        json: true
      };
      return rp(requestOptions);
    })
    .then(data =>{
      res.json({
        note: 'New block mined & broadcast succesfully.',
        block: newBlock,
      });
    })

});

app.post('/recieve-new-block', function(req, res){
  const newBlock = req.body.newBlock;
  const lastBlock = bitcoin.getLastBlock();
  const correctHash = lastBlock.hash === newBlock.previousBlockHash;
  const correctIndex = lastBlock['index'] +1 === newBlock['index'];
  if(correctHash && correctIndex) {
    bitcoin.chain.push(newBlock);
    bitcoin.pendingTransactions = [];
    res.json({
      note: 'New block recieved and accepted',
      newBlock: newBlock
    });
  }else{
    res.json({
      note: 'New block rejected',
      newBlock: newBlock
    });
  }
});

app.post('/register-and-broadcast-node', function(req, res){
  //this endpoint will register a node and broadcast that node to the whole network.
    const newNodeURL = req.body.newNodeURL;
    if(bitcoin.networkNodes.indexOf(newNodeURL) == -1)
      bitcoin.networkNodes.push(newNodeURL); // we are pushing the newNodeURL into networkNodes.
    
    const regNodePromises = [];
    bitcoin.networkNodes.forEach(networkNodeURL => {
        const requestOptions = {
          uri: networkNodeURL + '/register-node',
          method: 'POST',
          body: { newNodeURL : newNodeURL},
          json: true
        };
        regNodePromises.push(rp(requestOptions));
    });

    Promise.all(regNodePromises).then(data=>{
      const bulkRegisterOptions = {
        uri: newNodeURL + '/register-nodes-bulk',
        method: 'POST',
        body: { allNetworkNodes: [...bitcoin.networkNodes]},
        json: true
      };
      return rp(bulkRegisterOptions);
    })
    .then (data => {
      res.json({ note: 'New Node registered with network successfully' });
  })
    .catch(function(){
      console.log('Promise rejected. 2');
    });
    
});

app.post('/register-node', function(req, res){
  //this endpoint will register a node with the network
  const newNodeURL = req.body.newNodeURL;
	const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeURL) == -1;
	const notCurrentNode = bitcoin.currentNodeURL !== newNodeURL;
	if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeURL);
	res.json({ note: 'New node registered successfully.' });
});

app.post('/register-nodes-bulk', function(req, res){
  //this endpoint will register multiple nodes at once
  const allNetworkNodes = req.body.allNetworkNodes;
	allNetworkNodes.forEach(networkNodeURL => {
		const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeURL) == -1;
		const notCurrentNode = bitcoin.currentNodeURL !== networkNodeURL;
		if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeURL);
	});

	res.json({ note: 'Bulk registration successful.' });
});

app.get('/consensus', function(req, res){
  //we're going to create a consensus algorithm that implements the longest chain rule.
  //if there is a chain found that has a longer length than the chain that's present on the 
  //chosen node, the algorithm is going to replace the chain that's on the chosen node with the longest chain in the network.
  const requestPromises = [];
  bitcoin.networkNodes.forEach(networkNodeURL => {
      const requestOptions = {
          uri: networkNodeURL + '/blockchain',
          method: 'GET',
          json: true
      };
      requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises).then(blockchains => {
      const currentChainLength = bitcoin.chain.length;
      let maxChainLength = currentChainLength;
      let newLongestChain = null;
      let newPendingTransactions = null;

      blockchains.forEach(blockchain => {
        if(blockchain.chain.length > maxChainLength){
            maxChainLength = blockchain.chain.length;
            newLongestChain = blockchain.chain;
            newPendingTransactions = blockchain.pendingTransactions;
        };
      });

      if(!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))){
        res.json({
          note: 'Current chain has not been replaced.',
          chain: bitcoin.chain
        });
      }else{
        bitcoin.chain = newLongestChain;
        bitcoin.pendingTransactions = newPendingTransactions;
        res.json({
            note: 'This chain has been replaced.',
            chain: bitcoin.chain
        });
      }
  })
  .catch(function(){
    console.log('Promise rejected. 3');
  });
});

// somehow uuid library didn't work for me so I wrote my function
// you can try to use uuid library if you want
function guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + s4()+ s4() +
      s4() +  s4() + s4() + s4();
  }
