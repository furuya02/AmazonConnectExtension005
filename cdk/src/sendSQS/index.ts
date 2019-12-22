import * as AWS from 'aws-sdk';
if(process.env.IsLocal=='Yes') {
    AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: 'local-admin'});
    AWS.config.update({region:'ap-northeast-1'});
}

const url = process.env.QUEUE_URL!;

exports.handler = async (event: any) => {
  console.log(JSON.stringify(event));

  const sqs = new AWS.SQS();
  const params: AWS.SQS.SendMessageRequest = {
      MessageBody: JSON.stringify(event),
      QueueUrl: url,
  };
  const result = await sqs.sendMessage(params).promise();

  console.log(result);
  return {};
}

