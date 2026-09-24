# @alien-form/sdk

Alien Form 数据 API 的 JavaScript SDK，支持浏览器和 Node.js 18+。

## 使用

```js
import AlienClient from "@alien-form/sdk";

const client = new AlienClient({
  baseUrl: "https://example.com",
});

await client.auth.authWithPassword("admin", "password");

const articles = client.collection("articles");
const page = await articles.getList(1, 20, {
  filter: "published = true",
  sort: "-createdAt",
});

const article = await articles.create({ title: "Hello" });
await articles.update(article.id, { title: "Updated" });
await articles.delete(article.id);
```

`baseUrl` 可以传服务根地址，也可以直接传 `/api/v1` 地址。浏览器环境默认将认证状态保存到 `localStorage`；Node.js 和 SSR 环境默认使用内存存储，也可以通过 `authStore` 注入自定义存储。

## API

- `client.auth.authWithPassword(username, password)`
- `client.auth.logout()`
- `client.collection(model).getList(page, perPage, options)`
- `client.collection(model).getFullList(options)`
- `client.collection(model).getOne(id)`
- `client.collection(model).create(data)`
- `client.collection(model).update(id, data)`
- `client.collection(model).delete(id)`
- `client.collection(model).deleteMany(ids)`
- `client.collection(model).getOptions(options)`
- `client.collection(model).getSubtree(options)`
- `client.collection(model).execute(command, body)`
- `client.models.list()`
- `client.models.get(name)`

请求失败会抛出 `AlienError`，可通过 `error.status` 获取 HTTP 状态码，通过 `error.data` 获取服务端附加数据。
