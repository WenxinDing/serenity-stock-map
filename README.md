# Serenity / 白毛股神日线观点地图

这是一个静态 Cloudflare Pages 站点。页面入口是 `index.html`，行情和归档数据分别是 `market-data.json` 与 `archive.json`。

## Cloudflare Pages 发布

需要先安装 Wrangler 并登录 Cloudflare：

```powershell
npm install -g wrangler
wrangler login
wrangler pages project create serenity-stock-map
wrangler pages deploy . --project-name serenity-stock-map
```

之后每次更新行情或页面后，重新执行：

```powershell
wrangler pages deploy . --project-name serenity-stock-map
```

也可以把目录推送到 GitHub，再在 Cloudflare Pages 选择 Git integration，构建命令留空（或 `exit 0`），输出目录填 `.`，即可获得自动部署和预览版本。

观点归档是公开数据集，不代表 X 官方全量历史；页面保留了覆盖限制提示。
