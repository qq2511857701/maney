# 散光软镜度数换算工具

粘贴客户验光数据，自动对齐原站选项并换算隐形眼镜试戴参数。

在线地址（部署后）：`https://你的用户名.github.io/maney/`

## 部署到 GitHub Pages（免费）

### 1. 推送到 GitHub

```bash
cd D:\code\todo\maney
git init
git add .
git commit -m "init: 散光软镜度数换算工具"
git branch -M main
git remote add origin https://github.com/你的用户名/maney.git
git push -u origin main
```

### 2. 开启 Pages

仓库 **Settings → Pages → Source** 选 **GitHub Actions**。

推送后 workflow 会自动部署，1~2 分钟后可访问。

### 为什么不需要服务器？

换算 API（`ax.51i.cc`）支持浏览器跨域，GitHub Pages 托管静态文件即可。

---

## 本地开发（可选）

```bash
node server.mjs
```

打开 http://localhost:3456

---

## 支持的输入格式

**订单行（可一行多条）：**
```
-8.25,-1.25,180（1盒）-7.50,-125,180（1盒）
-3.50，100，179（1盒）
```

**验光单：**
```
R: -10.00 / -2.00 x 175
L: -9.00 / -2.00 x 30
OD: -5.75 / -1.25 x 10
OS: -7.00 / -0.75 x 160
```

**聊天格式：**
```
右眼(R) 近视525度(-5.25) 散光100度(-1.00) 轴位180
左眼(L) 近视450度(-4.50) 散光200度(-2.00) 轴位170
```

## 使用流程

1. 粘贴文本 →「解析文本」
2. 在校对表确认/修改（盒数默认 1）
3. 「换算」→ 查看结果 →「复制结果」

客户数据会先对齐原站下拉框步进（球镜/柱镜 0.25、轴位 5），再调用原站 API 换算。
