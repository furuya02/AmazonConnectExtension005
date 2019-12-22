import cdk = require('@aws-cdk/core');
import * as lambda  from '@aws-cdk/aws-lambda';
import * as s3  from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import fs = require('fs');

// 識別するためのタグ(バケット名にも使用されるので_は使えない)
const tag = "connect-ex-voicemail";
// Lambdaのタイムゾーン
const timeZone = 'Asia/Tokyo';
// // Amazon Connectの設定を転記して下さい。
// const wavBucketName = 'connect-ea747ad00a36';

export class AmazonConnectExtension005Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 出力を保存するバケット名
    const outputBucketName = tag + "-" + this.account;

    // 録音データが保存されるバケット
    // const wavBucket = s3.Bucket.fromBucketName(this, "wavBucket", wavBucketName);
    //出力を保存するバケット
    const outputBucket = new s3.Bucket(this, tag + '-outputBucket', {
      bucketName: outputBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

 

/*
    readonly queueName?: string;
    readonly retentionPeriod?: Duration;
    readonly deliveryDelay?: Duration;
    readonly maxMessageSizeBytes?: number;
    readonly receiveMessageWaitTime?: Duration;
    readonly visibilityTimeout?: Duration;
    readonly deadLetterQueue?: DeadLetterQueue;
    readonly encryption?: QueueEncryption;
    readonly encryptionMasterKey?: kms.IKey;
    readonly dataKeyReuse?: Duration;
    readonly fifo?: boolean;

    readonly contentBasedDeduplication?: boolean;
    */
    // const topic = new sns.Topic(this, 'CdkWorkshopTopic');
    // topic.addSubscription(new subs.SqsSubscription(queue));


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

    // - arn:aws:iam::aws:policy/AmazonS3FullAccess
    // - arn:aws:iam::aws:policy/AmazonKinesisVideoStreamsReadOnlyAccess
    // - arn:aws:iam::aws:policy/AmazonSQSFullAccess

  
    // // S3にWAVが保存された時のイベントにトリガーを仕掛けるファンクション
    // const setNotificationFunction = new lambda.SingletonFunction(this, tag + '-setNotificationFunction', {
    //   uuid: 'fa394ca7-e346-4a71-9fc1-0e9d03e7edd0',
    //   code: new lambda.InlineCode(fs.readFileSync('src/setNotificationFunction/index.js', { encoding: 'utf-8' })),
    //   handler: 'index.handler',
    //   timeout: cdk.Duration.seconds(300),
    //   runtime: lambda.Runtime.NODEJS_8_10,
    // });
    
    // // イベントにトリガーを追加削除する権限付与
    // setNotificationFunction.addToRolePolicy(new iam.PolicyStatement({
    //   resources: [wavBucket.bucketArn],
    //   actions: ['s3:*'] }
    // ));


    // // 出力に設定ファイル用バケット名を表示
    // new cdk.CfnOutput(this, "TranscribeBucket", {
    //   value: outputBucket.bucketName
    // });
  }
}




 