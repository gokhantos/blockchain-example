# blockchain-example
This repository is the source code that accompanies a book on packtpub.com
The book is called "Learn Blockchain Programming with JavaScript"
### Getting Started
[Latest NodeJS version](https://nodejs.org/en/download/)
[Postman for API development](https://www.postman.com/)
### Requirements
```bash
npm install --save express
npm install --save request-promises
npm install --save sha256
npm install --save body-parser
```
### Usage
This blockchain is hosted on localhost. The third argument that you give when you run the api.js file is the port number. For example:
```bash
node api.js 3000
```
After running blockchain api register and broadcast all nodes by using Postman:
```json
{
    "newNodeURL": "http://localhost:3001"
}
```
Add a transaction and broadcast by Postman:
```json
{
    "amount": 100,
    "sender": "JDHEJFGH34JD",
    "recipient": "NVJDH43HAD"
}
```

This transaction can be seen in pendingTransactions list on localhost:3000/blockchain

In order to mine this block go to localhost:3000/mine
