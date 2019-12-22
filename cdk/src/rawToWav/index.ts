import * as AWS from 'aws-sdk';
if(process.env.IsLocal=='Yes') {
    AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: 'local-admin'});
    AWS.config.update({region:'ap-northeast-1'});
}

const ConnectVoiceMail = require("./ConnectVoiceMail");
const bucketName = process.env.BUCKET_NAME!;
const region = process.env.REGION;


exports.handler = async (event: any) => {
    console.log(JSON.stringify(event));

    for(var i=0; i<event.Records.length; i++) {
        const body = JSON.parse(event.Records[i].body);
        const audio = body.Details.ContactData.MediaStreams.Customer.Audio;
        const streamName = audio.StreamARN.split('stream/')[1].split('/')[0];
        const fragmentNumber = audio.StartFragmentNumber;
        const startTime = new Date(Number(audio.StartTimestamp));

        console.log('streamName:' + streamName);
        console.log('fragmentNumber:' + fragmentNumber);

        const connectVoiceMail = new ConnectVoiceMail();
        const wav = await connectVoiceMail.getWav(region, streamName, fragmentNumber);

        const s3 = new AWS.S3({region:region});
        const key = dateString(startTime) + '.wav';
        console.log('wavFile: ' + key);
        const params = {
            Bucket: bucketName,
            Key: key,
            Body: Buffer.from(wav.buffer),
        };
        await s3.putObject(params).promise();
    }
    return {}
}

function dateString(date: Date) {
    const year = date.getFullYear();
    const mon = (date.getMonth() + 1);
    const day = date.getDate();
    const hour = date.getHours();
    const min = date.getMinutes();

    const space = (n: number) => {
        return ('0' + (n)).slice(-2)
    }

    let result = year + '-';
    result += space(mon) + '-';
    result += space(day) + '_';
    result += space(hour) + ':';
    result += space(min);
    return result;
}


