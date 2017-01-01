// TODO 這邊還要補齊 /v1/status，與測試程式
var express = require('express');
var transactionData = require('../db/models/transactionData.js');
var searchTransaction = require('../db/models/searchTransaction.js');
var producer = require('../kafka/producer/producer.js');
var Web3 = require('web3');
var web3 = new Web3();
var router = express.Router();

var kafkaTopic = 'InsertQueue';
web3.setProvider(new web3.providers.HttpProvider(process.env.ENODE_BASE || 'http://localhost:8545'));

var kafka = require('kafka-node'),
                HighLevelProducer = kafka.HighLevelProducer,
                client = new kafka.Client("127.0.0.1:2181"),
                producer = new HighLevelProducer(client),
                message = {};

/**
 * 把基本服務的 API 都放在這邊
 */

/**
 * PUT data
 * 把資料存入，回傳 txHash
 * @param data
 */
router.put('/v1/data', function(req, res, next) {
    // Step 1: Insert TransactionData
    if (req.body.data != null && req.body.data != '') {
        transactionData.create({"data": JSON.stringify(req.body.data)}).then(function (result) {
            // 寫入 kafka            
            message[result] = JSON.stringify(req.body.data);

            var payloads = [
                {topic: kafkaTopic, messages: JSON.stringify(message)}
            ];
            // Step 2: Put to Kafka queue
            // FIXME Kafka producer 要做 error handling，有錯要重送，這邊我測試如果沒有打開 Kafka 一樣會過
            producer.send(payloads);
            res.json({'data': {'txHash': result}});
        }).catch(function (err) {
            // error handle
            console.log(err.message, err.stack);
            res.json({'error': {'message': err.message}});
        });
    } else {
        res.json({'error': {'message': 'invalid data'}});
    }
});

/**
 * Get txHash information
 * @param txHash
 */
router.get('/v1/status', function(req, res, next) {
    if (req.query.txHash != null && req.query.txHash != '') {
        transactionData.read(req.query.txHash).then(function(result){
            console.log(result);
            // FIXME 這邊要看狀態把資料丟出去
            var transaction = {txHash: req.query.txHash, fromAddress: web3.eth.coinbase};
            if (result.rowCount > 0) {
                transaction[status] = result.rows[0].status;
                searchTransaction.create(transaction);
                res.json({'data': {
                    'txHash': result.rows[0].txHash,
                    'status': result.rows[0].status,
                    'txTimestamp': result.rows[0].txTimestamp,
                    'tx': result.rows[0].transactionHash}
                });
            } else {
                transaction[status] = 'ERROR';
                searchTransaction.create(transaction);
                res.json({'error': {'message': 'invalid txHash'}});
            }
        }).catch(function (err) {
            console.log(err.message, err.stack);
            res.json({'error': {'message': err.message}});
        });
    } else {
        res.json({'error': {'message': 'invalid txHash'}});
    }
});

module.exports = router;
