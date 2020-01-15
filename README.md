# Iiiissshh!

There are things that cause a GitLab job failed and we've to retry it manually (think about network connection related issues). `cobalagi` is a bot that does these silly retry attempts automatically. `cobalagi` responds to GitLab Slack app message like `fooGroup/barProject: Pipeline #134 of branch dev-123 by Fulan (fulan) failed in 02:16`.

<img width="615" alt="Screen Shot 2020-01-15 at 23 50 20" src="https://user-images.githubusercontent.com/2534060/72453555-2ce57700-37b7-11ea-8a59-0f07d77e01fa.png">

You can set your own causes by strings like `Failed to connect`, `unable to access` or `connection timeout`.

# Usage

- Copy .env-default to .env
- Set your own values to .env
- `npm run start`

