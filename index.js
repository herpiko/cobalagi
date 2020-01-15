const axios = require('axios');
const SlackBot = require('slackbots');
const dotenv = require('dotenv');
const maxRetries = parseInt(process.env.MAX_RETRIES, 10);
const map = {};

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
  var repoPath = message
    .split(process.env.BASE_URL + '/')[1]
    .split('>')[0]
    .split('|')[0];
  var projectName = repoPath.split('/')[repoPath.split('/').length - 1];
  var projectId = null;
  var jobId = null;
  var cause = null;
  var shouldRetry = false;
  var retryId = projectName + pipelineId;
  console.log('namespace ', repoPath);
  console.log('projectName ', projectName);
  console.log('pipelineId ', pipelineId);
  // Get the project info
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
      for (let i in res.data) {
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
      // Get the pipeline info
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
      res.data.reverse();
      // The first should be the latest job
      if (res.data.length > 0 && res.data[0].status === 'failed') {
        jobId = res.data[0].id;
      }
      if (!jobId) {
        throw new Error('failed job id not found');
      }
      console.log('jobId ', jobId);
      // Get the job log
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
      let causes = process.env.CAUSES.split(',');
      for (let i in causes) {
        if (res.data.indexOf(causes[i]) > -1) {
          let lines = res.data.split('\n');
          for (let j in lines) {
            if (lines[j].indexOf(causes[i]) > -1) {
              cause = lines[j];
            }
          }
          shouldRetry = true;
          break;
        }
      }
      console.log('shouldRetry ', shouldRetry);
      if (!shouldRetry) {
        throw new Error('should not be retried');
      }
      map[retryId] = map[retryId] || 0;
      map[retryId] += 1;
      if (map[retryId] > maxRetries) {
        console.log('MAX_RETRIES reaced for ' + retryId);
        return;
      } else {
        setTimeout(() => {
          // Let give it a second before retry
          axios
            .post(
              process.env.BASE_URL +
                '/api/v4/' +
                'projects/' +
                projectId +
                '/jobs/' +
                jobId +
                '/retry?private_token=' +
                process.env.GITLAB_TOKEN,
            )
            .then(res => {
              console.log('Successfully retried.');
              let msg = cause;
              msg +=
                '\n\n' +
                repoPath +
                '/pipelines/' +
                pipelineId +
                ' JobID ' +
                jobId +
                ' is successfully retried (attempt ' +
                map[retryId] +
                ').';
              console.log(data);
              console.log(msg);
              bot.postMessageToChannel(process.env.CHANNEL, msg);
            });
        }, 1000);
      }
    })
    .catch(err => {
      console.log(err.message);
    });
}
