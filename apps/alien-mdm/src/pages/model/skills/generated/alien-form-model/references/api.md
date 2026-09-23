# 模型接口

- 服务地址：`__ALIEN_FORM_BASE_URL__`
- 新增：`POST /api/v1/models`
- 查询：`GET /api/v1/models/{name}`
- 编辑：`PUT /api/v1/models/{name}`
- 请求头：`Accept: application/json`、`Content-Type: application/json`
- 认证信息：读取 `references/connection.json`
- 新增与编辑请求体：完整 `AlienSchema`
- 协议或存储错误：HTTP 400，应根据响应中的精确路径修正模型
- 未认证：HTTP 401，应停止并要求重新下载 Skill
- 模型不存在：HTTP 404
- 同名冲突：HTTP 409
