<a href="https://github.com/eshengsky/noginx"><img src="https://github.com/eshengsky/noginx/blob/master/web/static/img/noginx.png" height="120" align="right"></a>

# Noginx

基于 Node.js 的高性能 HTTP 及反向代理服务器，类似于 [Nginx](http://nginx.org/)。

### Noginx的含义

Noginx 不是 No nginx（否定 nginx），而是 Node.js based nginx（基于 Node.js 的 nginx），更是 Not only nginx（不仅仅是 nginx）。

### 为什么使用Noginx

如果你的项目符合以下任一点，你就可以尝试使用 Noginx：
* 你的项目本身就是基于 Node.js，你希望代理服务器也使用相同的技术；
* 你的团队更熟悉 JavaScript，而不是 C/C++/Lua；
* 你希望有一个 WebUI 配置界面，而不是过时的纯文本配置方式；
* 你想要能随时配置路由规则，但又不想重启代理服务器；
* Nginx 已经满足不了你了 —— 例如：你想在代理端发请求验证用户的登录状态，而不是在浏览器端才去验证；
* ...

### 界面预览

![image](https://raw.githubusercontent.com/eshengsky/noginx/master/preview.png)

### 功能与特色

* 静态文件处理
    * 支持目录或指定文件
    * 酷炫的文件选择器
* URL 重写
* 反向代理
    * 基于 [node-http-proxy](https://github.com/nodejitsu/node-http-proxy)
    * 支持负载均衡
    * 支持按服务器性能配置权重
* 自定义响应
    * 可以无需发布直接配置页面
    * 网页版 Visual Studio Code 体验
* 服务端缓存
    * 支持自定义缓存 key
* 身份验证控制
* WebUI 配置界面
    * 配置站点支持权限管理
* 修改规则配置后无需重启
* 集成日志查看神器 [chrome-extension-server-log](https://github.com/eshengsky/chrome-extension-server-log)
* Noginx 处理的网页都支持 [调试模式](#调试模式)

### 与 Nginx 的比较

|   服务器   | 并发能力 | 静态资源处理能力 | 配置方式 | 配置备份 | 是否需重启 | 扩展能力 |
|:----------:|----------|---------------|--------------|------------|------------|------------|
| Nginx      | 很强 | 很快 | 纯文本配置方式，易拼写错误或重复，配置存储在本地文件中。 | 通常需手动备份，也没有配置修改记录。 | 通常需重启服务。 | 强，但需要掌握 C、Lua 等语言，且要运维去担任开发角色。 |
| Noginx | 很强 | 一般（但通常有CDN） | WebUI 配置界面，支持下拉选择、格式检查等，配置存储在数据库中。 | 任何配置操作（包括删除）都会在数据库中存档以供追溯和恢复。| 支持运行时修改并生效，无需重启。 | 强，全端技术统一（JavaScript），可方便地添加任何想要的逻辑。 |

### 流程图

Noginx 处理请求从接收到响应的基本流程示意：  
[Noginx Workflow](https://www.processon.com/view/link/5b46c90be4b00c2f18c9b5f7)

### 快速开始

#### 下载源码

点击 `Clone or download` 下载源码，或在 [Release](https://github.com/eshengsky/noginx/releases) 页面下载指定版本代码。

#### 安装依赖

```bash
$ npm install
```

#### 启动 Noginx

```bash
$ node server.js
```

访问 [http://localhost:9000/noginx/](http://localhost:9000/noginx/)，默认用户名/密码：dev/123456.

### 配置说明

Noginx 中的配置可分为 2 类：系统配置和规则配置。

* 系统配置

一般是服务器启动时就需要获取并生效的配置参数，如数据库连接等，需要手动修改配置文件，修改后必须重启 Noginx。

配置文件必须放置于 `/config/` 目录下，你可以通过启动服务器时传入变量 `config` 来指定当前环境使用哪个配置文件。如：

```bash
$ config=test node server.js
```

会自动读取 `/config/test.js` 配置文件。  
如果没有显式传入 `config`， 则会取 `NODE_ENV` 环境变量作为配置文件名，如：

```bash
$ NODE_ENV=production node server.js
```
这会自动读取 `/config/production.js` 配置文件。  

#### 配置项说明

##### proxyTimeout
Number 类型，反向代理的超时时长，单位毫秒

##### keepAlive
Number 类型，反向代理keep-alive时长，单位毫秒

##### job
String 类型，自动更新的调度规则，配置格式可参照 https://github.com/node-schedule/node-schedule#cron-style-scheduling

##### staticDirPath
String 类型，文件选择器中的静态文件根目录

##### debugParam
String 类型，调试模式的参数名

##### methods
Array 类型，请求方式配置

##### permissions
Array 类型，页面的身份验证

##### auth
Object 类型，Noginx系统的访问权限配置

#### auth.users
Object 类型，允许登录的用户，属性名是登录名，属性值是密码，密码必须经过md5加密

#### auth.editableUsers
Array 类型，允许编辑的用户，如：['user1', 'user2']，配置为 ['*'] 则所有用户都有编辑权限

#### serverFileCache
Object 类型，静态资源服务端缓存设置

#### serverFileCache.enable
Boolean 类型，是否开启服务端缓存

#### serverFileCache.max
Number 类型，所有缓存值的总大小限制

#### serverFileCache.maxAge
Number 类型，缓存过期时间，单位毫秒

#### db
Object 类型，数据库配置

#### db.mongodb
String 类型，MongoDB 连接字符串，支持集群

#### db.redisKeyPrefix
String 类型，Redis 键前缀

#### db.redisConnect
String 或 Array 类型，Redis 连接信息，如果配置为一个数组则视为集群

#### log4js
Object 类型，[log4js](https://github.com/log4js-node/log4js-node/tree/v1.1.1) 模块配置参数

* 规则配置

规则配置是指与请求相关联的路由、服务器、缓存等配置信息，通过访问 [http://localhost:9000/noginx/](http://localhost:9000/noginx/) 进行修改，系统会定时自动更新配置，故修改后无需重启服务器。

### 环境部署

推荐使用 [pm2](https://pm2.io/runtime/) 进行 Node.js 的进程管理和持久运行。  
注：你可以指定当前环境要使用的配置文件，详见 [配置说明](#配置说明)。

#### 安装pm2

```bash
$ npm install -g pm2
```

#### 启动服务

```bash
$ NODE_ENV=production pm2 start server.js -i 0
```

### 日志查看

* 本地开发环境，直接在终端中查看日志
* 部署到环境上后，使用 `pm2 logs` 查看日志
* 使用 [chrome-extension-server-log](https://github.com/eshengsky/chrome-extension-server-log) 在浏览器 F12 中查看日志

### 调试模式

可以方便地查看前后端日志、前端错误信息、存储信息等，尤其是在移动设备上。  
启动方式：在当前页面 URL 中加入参数 `h5debug=true`。  
基于 [eruda](https://github.com/liriliri/eruda) 打造。

### 使用帮助

登录后访问 http://localhost:9000/noginx/help/ 查看帮助。

### 性能测试
见 [benchmark](https://github.com/eshengsky/noginx/tree/master/benchmark) 目录。