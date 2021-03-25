# 性能测试

node-proxy 性能基准测试。

### 先决条件

所有基准测试都使用 [wrk](https://github.com/wg/wrk) 完成，这与 node.js 核心团队进行性能测试所使用的工具相同。确保在继续之前安装了 wrk。  
备注：wrk 不支持 Windows 平台，但如果你使用的是 Win10 系统，你可以尝试安装 [Linux 子系统](https://docs.microsoft.com/en-us/windows/wsl/install-win10)。

```bash
$ wrk
Usage: wrk <options> <url>                            
  Options:                                            
    -c, --connections <N>  Connections to keep open   
    -d, --duration    <T>  Duration of test           
    -t, --threads     <N>  Number of threads to use   
                                                      
    -s, --script      <S>  Load Lua script file       
    -H, --header      <H>  Add header to request      
        --latency          Print latency statistics   
        --timeout     <T>  Socket/request timeout     
    -v, --version          Print version details      
                                                      
  Numeric arguments may include a SI unit (1k, 1M, 1G)
  Time arguments may include a time unit (2s, 2m, 2h)
```

### 测试数据

#### 环境
* Ubuntu 16.04, 6G, 4核
* Node.js v8.9.4
* pm2 v3.0.0
* node-proxy v1.1.0
* nginx v1.10.3

#### 服务器

* 原始 Node.js 服务器
```bash
$ NODE_ENV=production pm2 reverseServer.js -i 4
```
运行在 `http://127.0.0.1:9001` 。

* node-proxy 服务器
```bash
$ NODE_ENV=production config=development pm2 server.js -i 4
```
运行在 `http://127.0.0.1:9000` 。
配置为：`/testProxy` 转发至 `http://127.0.0.1:9001` 。

* nginx 配置
```
server {
  listen 80;
  location /testProxy {
    proxy_pass http://127.0.0.1:9001;
  }
}
```
运行在 `http://127.0.0.1` 。

#### 原始数据
每次都是 200 connections，持续 10s，重复3次。

* 原始服务器
```
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1:9001
Running 10s test @ http://127.0.0.1:9001
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     4.62ms    4.79ms 272.12ms   92.11%
    Req/Sec    23.78k     5.33k   33.23k    66.50%
  474182 requests in 10.03s, 58.79MB read
Requests/sec:  47271.77
Transfer/sec:      5.86MB
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1:9001
Running 10s test @ http://127.0.0.1:9001
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     4.97ms    4.70ms 155.25ms   94.50%
    Req/Sec    21.99k     1.78k   27.31k    72.00%
  437757 requests in 10.01s, 54.27MB read
Requests/sec:  43739.49
Transfer/sec:      5.42MB
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1:9001
Running 10s test @ http://127.0.0.1:9001
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     4.79ms    7.14ms 193.08ms   95.22%
    Req/Sec    26.28k     4.61k   34.94k    68.00%
  523947 requests in 10.02s, 64.96MB read
Requests/sec:  52267.42
Transfer/sec:      6.48MB
```

* node-proxy 反向代理
```
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1:9000/testProxy
Running 10s test @ http://127.0.0.1:9000/testProxy
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    45.10ms   69.25ms   1.03s    97.49%
    Req/Sec     2.77k   536.85     6.13k    87.88%
  54758 requests in 10.04s, 10.71MB read
Requests/sec:   5454.71
Transfer/sec:      1.07MB
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1:9000/testProxy
Running 10s test @ http://127.0.0.1:9000/testProxy
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    38.09ms   28.07ms 520.50ms   95.13%
    Req/Sec     2.79k   237.94     3.55k    84.50%
  55683 requests in 10.02s, 10.89MB read
Requests/sec:   5554.98
Transfer/sec:      1.09MB
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1:9000/testProxy
Running 10s test @ http://127.0.0.1:9000/testProxy
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    40.73ms   43.59ms 827.20ms   97.40%
    Req/Sec     2.79k   441.30     5.00k    87.00%
  55493 requests in 10.02s, 10.85MB read
Requests/sec:   5539.56
Transfer/sec:      1.08MB
```

* nginx 反向代理
```
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1/testProxy
Running 10s test @ http://127.0.0.1/testProxy
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    25.00ms    4.82ms  54.84ms   77.70%
    Req/Sec     4.01k   558.03     4.93k    67.00%
  79890 requests in 10.01s, 12.26MB read
Requests/sec:   7982.36
Transfer/sec:      1.23MB
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1/testProxy
Running 10s test @ http://127.0.0.1/testProxy
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    24.45ms    6.72ms  83.89ms   90.04%
    Req/Sec     4.14k   670.70     5.22k    74.00%
  82428 requests in 10.01s, 12.65MB read
Requests/sec:   8236.37
Transfer/sec:      1.26MB
sky@sky-ubuntu:~$ wrk -c 200 -d 10s http://127.0.0.1/testProxy
Running 10s test @ http://127.0.0.1/testProxy
  2 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    23.73ms    4.56ms  91.40ms   85.77%
    Req/Sec     4.24k   475.70     4.95k    75.00%
  84342 requests in 10.01s, 12.95MB read
Requests/sec:   8429.88
Transfer/sec:      1.29MB
```
