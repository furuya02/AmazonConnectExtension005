import cdk = require('@aws-cdk/core');
import * as lambda  from '@aws-cdk/aws-lambda';
import * as s3  from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

// 識別するためのタグ(バケット名にも使用されるので_は使えない)
const tag = "connect-ex-voicemail";
// Lambdaのタイムゾーン
const timeZone = 'Asia/Tokyo';

export class AmazonConnectExtension005Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 出力を保存するバケット名
    const outputBucketName = tag + "-" + this.account;

    //出力を保存するバケット
    const outputBucket = new s3.Bucket(this, tag + '-outputBucket', {
      bucketName: outputBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // 録音終了時に諸元だけをSQSへ保存する
    const queue = new sqs.Queue(this, tag + '-queue', {
      queueName: tag + "-queue",
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    // ConnectにキックされSQSに情報を送信するファンクション
    const sendSQSFunction = new lambda.Function(this, tag + '-sendSQSFunction', {
      functionName: tag + "-sendSQS",
      code: lambda.Code.asset('src/sendSQS'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(3),
      environment: {
          QUEUE_URL: queue.queueUrl,
          TZ: timeZone
      },
    });
    sendSQSFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:SendMessage'],
      resources: [queue.queueArn]
    }));

    // SQSから起動されKinesisVideoStreamsのRAWデータをWAVに変換するファンクション
    const rawToWavFunction = new lambda.Function(this, tag + '-rawToWav', {
      functionName: tag + "-rawToWav",
      code: lambda.Code.asset('src/rawToWav'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(300), // 変換に充分な時間を設定する
      environment: {
          TZ: timeZone,
          BUCKET_NAME: outputBucket.bucketName,
          REGION:     this.region
      },
    });
    // SQSの操作権限
    rawToWavFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:*'],
      resources: [queue.queueArn]
    }));
    // Kinesisの操作権限
    rawToWavFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['kinesisvideo:Get*','kinesisvideo:Describe*','kinesisvideo:List*'],
      resources: ['*']
    }));
    // S3の操作権限
    rawToWavFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject','s3:ListBucket'],
      resources: [outputBucket.bucketArn, outputBucket.bucketArn + '/*']
    }));
    // イベントトリガーをSQSとする
    rawToWavFunction.addEventSource(new SqsEventSource(queue, {
      batchSize: 10 
    }));

    // 出力に設定ファイル用バケット名を表示
    new cdk.CfnOutput(this, "OutputBucket", {
      value: outputBucket.bucketName
    });
  }
}




 