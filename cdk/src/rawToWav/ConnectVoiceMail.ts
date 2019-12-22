const ebml = require('ebml');
import * as AWS from 'aws-sdk';
if(process.env.IsLocal=='Yes') {
    AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: 'local-admin'});
    AWS.config.update({region:'ap-northeast-1'});
}
module.exports = class ConnectVoiceMail {


    async getWav(region: string, streamName: string, fragmentNumber: string) {
        const raw = await this._getMedia(region, streamName, fragmentNumber);
        const wav = this._createWav(raw, 8000);
        return wav;
    }

    async _getMedia(region: string, streamName: string, fragmentNumber: string) {
        // Endpointの取得
        const kinesisvideo = new AWS.KinesisVideo({region: region});
        const end = await kinesisvideo.getDataEndpoint({
            APIName: "GET_MEDIA",
            StreamName: streamName
        }).promise();
     
        // RAWデータの取得
        const kinesisvideomedia = new AWS.KinesisVideoMedia({endpoint: end.DataEndpoint, region:region});
        var params = {
            StartSelector: { 
                StartSelectorType: "FRAGMENT_NUMBER",
                AfterFragmentNumber:fragmentNumber,
            },
            StreamName: streamName
        };
        const data = await kinesisvideomedia.getMedia(params).promise();
        const decoder = new ebml.Decoder();
        let chunks: any[] = [];
        decoder.on('data', (chunk:any) => {
            if(chunk[1].name == 'SimpleBlock'){
                chunks.push(chunk[1].data);
            }
        });
        decoder.write(data["Payload"]);
         
        // chunksの結合
        const margin = 4; // 各chunkの先頭4バイトを破棄する
        var sumLength = 0;
        chunks.forEach( chunk => {
            sumLength += chunk.byteLength - margin;
        })
        var sample = new Uint8Array(sumLength);
        var pos = 0;
        chunks.forEach(chunk => {
            let tmp = new Uint8Array(chunk.byteLength - margin);
            for(var e = 0; e < chunk.byteLength -  margin; e++){
                tmp[e] = chunk[e + margin];
            }
            sample.set(tmp, pos);
            pos += chunk.byteLength - margin;
     
        })
        return sample.buffer;
    }

    // WAVファイルの生成
    _createWav(samples: any, sampleRate: number) {
        const len = samples.byteLength;
        const view = new DataView(new ArrayBuffer(44 + len));
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 32 + len, true);
        this._writeString(view, 8, 'WAVE');
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // リニアPCM
        view.setUint16(22, 1, true); // モノラル
        view.setUint32(24, sampleRate, true); 
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        this._writeString(view, 36, 'data');
        view.setUint32(40, len, true);
        let offset = 44;
        const srcView = new DataView(samples);
        for (var i = 0; i < len; i+=4, offset+=4) {
            view.setInt32(offset, srcView.getUint32(i));
        }
        return view;
    }
        
    _writeString(view: any, offset: number, str: string) {
        for (var i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }
}
