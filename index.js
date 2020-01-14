const axios = require('axios');
const SlackBot = require('slackbots');
const dotenv = require('dotenv');

dotenv.config();
const bot = new SlackBot({
  token: `${process.env.BOT_TOKEN}`,
  name: 'cobalagi',
});

bot.on('message', data => {
  if (data.type !== 'message') {
    return;
  }
  if (data.subtype !== 'bot_message') {
    return;
  }
  if (
    !(
      data.attachments &&
      data.attachments[0] &&
      data.attachments[0].text &&
      data.attachments[0].text.indexOf('failed in') > -1 &&
      data.attachments[0].text.indexOf('Pipeline') > -1
    )
  ) {
    return;
  }
  console.log('Lemme handle this.');
  handleMessage(data);
});
function handleMessage(data) {
  var message = data.attachments[0].text;
  var pipelineId = message.split('#')[1].split('>')[0];
  var repoPath = message.split(process.env.BASE_URL + '/')[1].split('>')[0].split('|')[0]
  var projectName = repoPath.split('/')[repoPath.split('/').length - 1]
  var projectId = null;
  var jobId = null;
  var shouldRetry = false;
  console.log('namespace ', repoPath);
  console.log('projectName ', projectName);
  console.log('pipelineId ', pipelineId);
  axios
    .get(
      process.env.BASE_URL +
        '/api/v4/' +
        'projects' +
        '?search=' +
        projectName +
        '&pagination=keyset&per_page=100&order_by=id&sort=asc&private_token=' +
        process.env.GITLAB_TOKEN,
    )
    .then(res => {
      console.log(res.data.length);
      console.log(res.data);
      for (let i in res.data) {
        console.log(res.data[i].path_with_namespace);
        if (res.data[i].path_with_namespace === repoPath) {
          projectId = res.data[i].id;
          break;
        }
      }
      console.log(projectId);
      if (!projectId) {
        throw new Error('project id not found');
      }
      console.log('projectId ', projectId);
      return axios.get(
        process.env.BASE_URL +
          '/api/v4/' +
          'projects/' +
          projectId +
          '/pipelines/' +
          pipelineId +
          '/jobs' +
          '?private_token=' +
          process.env.GITLAB_TOKEN,
      );
    })
    .then(res => {
      for (let i in res.data) {
        if (res.data[i].status === 'failed') {
          jobId = res.data[i].id;
          break;
        }
      }
      if (!jobId) {
        throw new Error('project id not found');
      }
      console.log('jobId ', jobId);
      return axios.get(
        process.env.BASE_URL +
          '/api/v4/' +
          'projects/' +
          projectId +
          '/jobs/' +
          jobId +
          '/trace?private_token=' +
          process.env.GITLAB_TOKEN,
      );
    })
    .then(res => {
      console.log(res.data);
      let causes = process.env.CAUSES.split(',');
      for (let i in causes) {
        if (res.data.indexOf(causes[i]) > -1) {
          shouldRetry = true;
          break;
        }
      }
      console.log('shouldRetry ', shouldRetry);
      if (!shouldRetry) {
        return;
      }
      return axios.post(
        process.env.BASE_URL +
          '/api/v4/' +
          'projects/' +
          projectId +
          '/jobs/' +
          jobId +
          '/retry?private_token=' +
          process.env.GITLAB_TOKEN,
      );
    })
    .then(res => {
      console.log('Successfully retried.');
      let msg =
        repoPath +
        '/pipelines/' +
        pipelineId +
        ' JobID ' +
        jobId +
        ' is successfully retried.';
      console.log(data);
      console.log(msg);
      bot.postMessageToChannel('brilife', msg);
    })
    .catch(err => {
      console.log(err.message);
    });
}
