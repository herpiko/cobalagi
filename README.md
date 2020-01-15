# Iiiissshh!

There are things that cause a GitLab job failed and we've to retry it manually (think about network connection related issues). `cobalagi` is a bot that does these silly retry attempts automatically. `cobalagi` responds to GitLab Slack app message like `fooGroup/barProject: Pipeline #134 of branch dev-123 by Fulan (fulan) failed in 02:16`.

# Usage

- Copy .env-default to .env
- Set your own values to .env
- `npm run start`

