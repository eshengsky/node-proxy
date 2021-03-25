###### **修改规则后要重启吗？**

不需要。Node Proxy 会根据配置每隔一段时间自动获取最新的路由、服务器等规则。

###### **如何设置匹配路径？**

匹配路径分为3种可选类型：开头、精确、正则。

* 开头

"开头" 表示匹配 URI 中路径的开头。但要注意：在匹配之前，如果匹配路径无后缀名且末尾无 `/`，则会在匹配路径后自动加上 `/`；如果请求路径无后缀名且末尾无 `/`，则会在请求路径后自动加上 `/`，然后再比较。示例：


匹配路径设为 `/webapp/abc`  
将匹配这些请求：  
`/webapp/abc`  
`/webapp/abc/`  
`/webapp/abc/list`  
`/webapp/abc/list?a=1`  
但不会匹配：  
`/webapp/abccba`

匹配路径设为 `/webapp/abc/`  
将匹配这些请求：  
`/webapp/abc`  
`/webapp/abc/`  
`/webapp/abc/list`  
`/webapp/abc/list?a=1`  
但不会匹配：  
`/webapp/abccba/`

匹配路径设为 `/webapp/abc.htm`  
将匹配这些请求：  
`/webapp/abc.htm`  
`/webapp/abc.html`  
`/webapp/abc.html/test`  

【特殊】 匹配路径设为 `/`  
将匹配任意请求，可以放在所有规则的最后作为兜底设置。

* 精确

"精确" 表示精确匹配 URI 中的路径。与 "开头" 类似，在匹配之前，如果匹配路径无后缀名且末尾无 `/`，则会在匹配路径后自动加上 `/`；如果请求路径无后缀名且末尾无 `/`，则会在请求路径后自动加上 `/`，然后再比较。示例：

匹配路径设为 `/webapp/abc`  
将匹配这些请求：  
`/webapp/abc`  
`/webapp/abc/`  
`/webapp/abc/?a=1`  
但不会匹配：  
`/webapp/abccba`  
`/webapp/abc/list`

匹配路径设为 `/webapp/abc/`  
将匹配这些请求：  
`/webapp/abc`  
`/webapp/abc/`  
`/webapp/abc/?a=1`  
但不会匹配：  
`/webapp/abccba/`  
`/webapp/abc/list`

* 正则

"正则" 表示进行正则表达式匹配。示例：

匹配路径设为 `^\/webapp\/product-\d+`  
将匹配这些请求：  
`/webapp/product-123`  
`/webapp/product-123/`

###### **如何设置发送静态文件？**

设置完匹配路径后，选择处理方式类型为 "静态文件"，在 "文件或目录：/data/nfsroot/client/static/" 后输入你想要对应的服务器的目录或文件路径即可。示例：

![image](/node-proxy/static/img/1.png)

当接收到请求：  
`/visa`  
将依次寻找：  
 `/data/nfsroot/client/static/webapp/busi/visa`、  
 `/data/nfsroot/client/static/webapp/busi/visa/index.html`、  
 `/data/nfsroot/client/static/webapp/busi/visa/index.htm`  
如果都找不到则显示404。

当接收到请求：  
`/visa/aaa/bbb/test.html`  
将寻找：  
 `/data/nfsroot/client/static/webapp/busi/visa/aaa/bbb/test.html`  
如果找不到则显示404。

但对于单页应用，路由由前端脚本控制，上面第 2 个例子就不适用了，此时可以尝试勾选 try_file，这样当找不到文件时，会尝试发送所配置文件路径下的index.html。示例：

![image](/node-proxy/static/img/2.png)

勾选 try_file 后，当接收到请求：  
`/visa/aaa/bbb/test.html`  
将依次寻找：  
 `/data/nfsroot/client/static/webapp/busi/visa/aaa/bbb/test.html`  
  `/data/nfsroot/client/static/webapp/busi/visa/index.html`  
如果找不到则显示404。

###### **如何设置URL重写？**

设置完匹配路径后，选择处理方式类型为 "URL重写"，在 "地址：" 后输入你想要重定向的 URL 即可。重写后的 URL 可以是相对路径、绝对路径或者带协议的完整网址。示例：

![image](/node-proxy/static/img/3.png)

当接收到请求：  
`/webapp/around`  
将重定向到：  
`/around` 

如果匹配路径是正则匹配，重定向后的地址支持替换子表达式（使用变量 $1, $2...）。示例：

![image](/node-proxy/static/img/4.png)

当接收到请求：  
`/webapp/product-123`  
将重定向到：  
`/product/123` 

如果你要支持将查询字符串一并带到重写后的 URL 中，可以使用变量 $query。示例：

![image](/node-proxy/static/img/9.png)

当接收到请求：  
`/place/123?a=1&b=2`  
将重定向到：  
`/ticket/piao-123?a=1&b=2` 

###### **如何设置转发？**

设置完匹配路径后，选择处理方式类型为 "转发"，在 "服务器：" 后选择你要转发到的服务器即可。服务器需要预先在 [服务器](/node-proxy/servers) 页面进行添加操作。示例：

![image](/node-proxy/static/img/5.png)

当接收到请求：  
`/mainSearch/index.html`  
该请求将被转发至 node_pro 服务器进行处理。

###### **如何创建服务器？**

在 [服务器](/node-proxy/servers/) 页面可以配置转发到的服务器信息。其中 "服务器地址" 必须是以 `http` 或 `https` 开头的完整地址。支持配置多个地址，系统会自动进行负载均衡。示例：

![image](/node-proxy/static/img/8.png)

###### **如何设置登录后才能访问？**

在 [身份验证](/node-proxy/permissions/) 页面可以配置哪些请求必须在身份验证通过后才能继续处理。  
当前有 2 种验证方式：  

* 仅允许已登录用户访问

系统会根据 Cookie 中的 `lvsessionid` 调用用户接口来判断当前用户是否已登录，如果未登录，则自动跳转到登录页面；如果已登录，则查找 [路由处理](/node-proxy/) 中是否有匹配的路由规则以进行后续操作。

* 微信访问时需要微信授权登录

如果当前页面是在微信中访问，且 Cookie 中没有 `session_id`，则认为未登录，自动跳转到微信授权页面；如果已登录，则查找 [路由处理](/node-proxy/) 中是否有匹配的路由规则以进行后续操作。

示例：

![image](/node-proxy/static/img/6.png)

当接收到请求：  
`/webapp/my`  
将首先判断是否已登录，如果未登录将跳转到登录页面。  

###### **什么是身份验证的排除项？**

在 [身份验证](/node-proxy/permissions/) 页面配置请求时，可以设置排除项，排除项将不走身份验证。示例：

![image](/node-proxy/static/img/7.png)

当接收到请求：  
`/webapp/my/main`  
不做身份验证，任何用户都可以访问该页面。

当接收到其它以 `/webapp/my` 开头的请求，如：  
`/webapp/my/orderList`  
将首先判断是否已登录，如果未登录将跳转到登录页面。

###### **如何配置缓存？**

TODO

###### **如何清除缓存？**

TODO
