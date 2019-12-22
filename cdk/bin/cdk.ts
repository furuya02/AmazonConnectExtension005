#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AmazonConnectExtension005Stack } from '../lib/cdk-stack';

const app = new cdk.App();
new AmazonConnectExtension005Stack(app, 'AmazonConnectExtension005Stack');
