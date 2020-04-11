const { sleep } = require('pure-func/promise')
const store = require('pure-func/simpleExpireStore')({}, timeout = 300000)
const {
  MQClient
} = require('../')

const {
  accessKeyId, accessKeySecret, topic, endpoint, consumerGroup, instanceId
} = require('./config.js')

const clusterPendingCounts = {
}

const incrementPendingCount = async (key, count) => {
  clusterPendingCounts[key] = clusterPendingCounts[key] || 0
  clusterPendingCounts[key] += count
  return clusterPendingCounts[key]
}

const checkDuplicatedMsg = async key => {
  if (store[key]) {
    return true
  }
  store[key] = true
  return false
}

const client = new MQClient(endpoint, accessKeyId, accessKeySecret, null, {
  pullBatchSize: 1,
  pullTimeDelayMillsWhenFlowControl: 1200,
  pullThresholdForQueue: 5,
  clusterPendingLimit: 6,
  incrementPendingCount,
  checkDuplicatedMsg
})

let delay = 0
let count = 0

const subscribeMsg = consumer => {
  consumer.subscribe(async msg => {
    await incrementPendingCount('test', 1)
    const body = JSON.parse(msg.body)
    delay += Date.now() - body.timestamp
    count += 1
    client.logger.info(consumer.nonce, '>>>>>>>', delay, count, delay / count, consumer.pendingCount, clusterPendingCounts)
    await sleep(3000)
    await incrementPendingCount('test', -1)
  })
}

[
  client.getConsumer(instanceId, topic, consumerGroup, 'test'),
  client.getConsumer(instanceId, topic, consumerGroup, 'test'),
  client.getConsumer(instanceId, topic, consumerGroup, 'test')
].map(subscribeMsg)

setInterval(() => {
  console.log(count ? delay / count : 0, count, clusterPendingCounts)
}, 2000)
