# Tony's Blog

## 项目简介
这是 Tony 的个人技术博客，基于 GitHub Pages + Jekyll 搭建，记录在 macOS 开发环境、视频编码处理、iOS 工程实践、算法题解等领域的探索与经验。仓库中的 Markdown 文件位于 `_posts/` 目录，遵循 Jekyll 的命名规范（`YYYY-MM-DD-title.md`），构建后会自动发布到公开站点。

## 目录结构
- `_posts/`：博客正文，按日期命名；
- `_drafts/`：草稿（可选目录，如需在本地撰写未发布文章）；
- `assets/`：静态资源，包括图片、示例代码附件等；
- `_config.yml`：站点与主题配置；
- `Gemfile`：Jekyll 运行所需依赖；
- `README.md`：当前说明文档。

## 本地预览
1. 安装依赖：
   ```bash
   bundle install
   ```
2. 启动预览服务：
   ```bash
    bundle exec jekyll serve
   ```
3. 在浏览器访问 `http://127.0.0.1:4000` 查看实时效果。

如需自定义构建参数，可通过 `bundle exec jekyll serve --livereload --drafts` 预览草稿与增量更新。

## 写作规范
- 文件名使用英文小写与连字符，前缀日期与文章发布日期保持一致；
- Front Matter 至少包含 `layout: post`、`title`、`date`、`categories`、`tags`；
- 正文默认使用简体中文，必要时提供英文术语；
- 代码块使用三反引号并指定语言标识，便于语法高亮；
- 图片统一放在 `assets/img/post/<文章名>/` 目录，并在 Markdown 中引用绝对路径；
- 文章结尾建议附上总结或后续阅读链接，保持结构一致性。

## 发布流程
1. 本地完成撰写与校稿；
2. 运行 `bundle exec jekyll build` 确认无错误；
3. 提交代码并推送至 `main` 分支；
4. GitHub Actions / Pages 将自动构建并发布最新内容。

如需回滚或重新发布，可通过 Git 标签管理历史版本。

## License
除非正文另有说明，本仓库内容按 CC BY-NC-SA 4.0 协议共享，代码示例可在合理引用范围内自由使用。欢迎引用或转载，请保留出处链接。*** End Patch
