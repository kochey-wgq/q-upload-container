


# q-upload-container 项目文档

## 项目概览

q-upload-container 是一个基于 React + TypeScript 的文件上传逻辑容器组件库。  该项目的核心理念是只提供文件上传的逻辑封装，不提供具体的UI组件，将UI的展示完全交给用户自定义实现, 当然可自行修改源码，毕竟也不难。


## 项目地址
[服务端地址](https://github.com/kochey-wgq/q-upload-server)
[客户端地址](https://github.com/kochey-wgq/q-upload-container)
## 快速启动
  1. **安装依赖**：
 
    npm install

  2. **开发模式运行**：

    npm run dev
 

  3. **生产环境打包**：

    npm run build


## 技术栈

- **框架**: React 19.0.0 + TypeScript
- **构建工具**: Vite + Rollup
- **核心依赖**: 
  - axios (HTTP请求)
  - crypto-js (文件哈希计算)
  - browser-image-compression (图片压缩)
  - antd (辅助组件)


### 核心文件结构

- `src/components/UploadContainer/` - 主容器组件
- `src/utils/uploadEventGather.ts` - 核心上传逻辑处理
- `src/common/index.ts` - 工具函数和大文件上传类
- `src/api/request.ts` - HTTP请求拦截器和处理
- `src/@types/global.d.ts` - 全局类型定义
- `src/workers/createFileChunks.ts` - Web Worker文件切片处理


## 使用示例

```typescript
import UploadContainer from 'q-upload-container';

const MyUploadComponent = () => {
  return (
    <UploadContainer
      requestOptions={{
        baseURL: 'https://api.example.com',
        url: '/upload',
        method: 'post'
      }}
      uploadOptions={{
        accept: ['image/*', 'video/*'],
        multiple: true,
        multipleNum: 5,
        chunkSize: 1024 * 1024 * 3, // 3MB
        compressionOptions: { // compression插件的压缩图片参数
          maxSizeMB: 1, // 压缩图片最大大小 
          useWebWorker: true, // 是否使用web worker进行压缩
        }
      }} 
      toggleCompressionImg={true}
    >
      {({ fileStartUpload, filePausedUpload, getResources }) => (
        <div>
          <input
            type="file"
            onChange={(e) => fileStartUpload({
              data: e,
              onProgress: (progress) => console.log(progress),
              result: (result) => console.log(result)
            })}
          />
          <button onClick={() => filePausedUpload(file)}>
            暂停上传
          </button>
        </div>
      )}
    </UploadContainer>
  );
};
```

## 核心功能

### 1. 容器组件 (UploadContainer)  

UploadContainer 是主要的容器组件，采用 renderProps 模式，通过 [propsAttribute](#propsAttribute) 向用户提供上传后相关的回调属性。

### 2. 核心逻辑类 (UploadEventGather) 

UploadEventGather 是核心逻辑处理类，负责：
- 文件参数处理和校验
- 小文件和大文件上传逻辑
- 图片压缩功能
- 进度回调处理

### 3. 大文件上传类 (LargeFile)

LargeFile 类提供大文件分片上传功能，包括：
- 文件分片切割
- 分片并发上传
- 断点续传
- 上传暂停/恢复
- 文件合并

### 4. 并发控制类 (RequestConcurrency)

RequestConcurrency 提供请求并发控制功能，支持：
- 最大并发数限制
- 请求队列管理
- 暂停/恢复功能

## API 参数说明

### UploadContainer 参数 
 
<table style="text-align: left;">
  <tr>
    <th>参数名</th> 
    <th>类型</th>
    <th>默认值</th>
    <th>说明</th>
    <th>必传</th>
  </tr>
  <tr>
    <td>toggleCompressionImg</td>
    <td>Boolean</td>
    <td>false</td>
    <td>是否开启图片压缩</td>
    <td>否</td>
  </tr>
  <tr>
    <td>toggleLargefile</td>
    <td>Boolean</td>
    <td>false</td>
    <td>是否开启大文件上传</td>
    <td>否</td>
  </tr>
  <tr>
    <td>requestOptions </td>
    <td>Object</td>
    <td>
        <a href="#requestOptions">点击跳转</a>
    </td>
    <td>请求配置</td>
    <td>是</td>
  </tr>
  <tr>
    <td>uploadOptions</td>
    <td>Object</td>
    <td>
        <a href="#uploadOptions">点击跳转</a>
    </td>
    <td>上传配置</td>
    <td>是</td>
  </tr>
</table>

注意：toggleCompressionImg（非大文件上传时）、toggleLargefile（不可与toggleCompressionImg叠加开启）。

<h4 id="requestOptions">requestOptions (请求配置)</h4> 

<table style="text-align: left;">
  <tr>
    <th>参数名</th> 
    <th>类型</th>
    <th>默认值</th>
    <th>说明</th>
    <th>必传</th>
  </tr>
  <tr>
    <td>baseURL</td>
    <td>String</td>
    <td>用户定制</td>
    <td>域名基础地址</td>
    <td>是</td>
  </tr>
  <tr>
    <td>method</td>
    <td>String</td>
    <td>用户定制</td>
    <td>请求方式</td>
    <td>是</td>
  </tr>
  <tr>
    <td>data</td>
    <td>FormData</td>
    <td>用户上传</td>
    <td>上传文件与参数</td>
    <td>是</td>
  </tr>
  <tr>
    <td>url</td>
    <td>String</td>
    <td>用户定制</td>
    <td>请求地址</td>
    <td>是</td>
  </tr>
  <tr>
    <td>largeUrl</td>
    <td>Object</td>
    <td>
        <a href="#largeUrl">点击跳转</a>
    </td>
    <td>当toggleLargefile开启时所需要的相关地址信息（不开启大文件分片时可不传）</td>
    <td>是</td>
  </tr>
</table>

说明：相关AxiosRequestConfig Parmas
```typescript
    // 需返回如下response响应体
    {
        "code": number,         // 200 -success 状态码
        "msg": string,          // 信息
        "data": any             // 数据
    }
```
<br/>
<br/>

<a id="largeUrl">非文件分片上传地址配置（不配置largeUrl即可）</a>
- `files` - 源文件列表（FileList类型）
- `accept` - 文件类型


<br/>
<br/>
<br/>

<a id="largeUrl">大文件分片上传地址配置（以下配置与Axios参数相同）</a>

注意：开启大文件上传时的地址配置，request（如有需要配合该项目的服务端则需要一致）、response 数据返回结构必须保持一致
- `largeUrl`
    <a id="upload"></a>
    - `upload` - 分片上传地址

    ```typescript
        // request（如有需要配合服务端则需要一致）
        {
            url: '/upload/largeChunk'       //用于配合该项目的服务端地址
            method: 'POST',                 //上传方式
            chunk：Blob                     //分片
            chunkIndex ：number             //分片索引
            fileHash ：  string             //分片哈希
            fileName :string                //文件名
            totalChunksSize ： number       //总分片大小            
            fileType :  string              //文件类型
            totalChunksNum ：number         //分片总块数
        }

        // response (返回的数据需要保持一致)
        {
            chunkSize: number,              // 每个分片大小(字节)
            index:number,                   // 当前分片索引
            totalChunksSize: number,        // 总分大小
            uploadedBytes : number          // 已上传的字节数
        }
    ```
    <a id="check"></a>
    - `check` - 分片查询地址  
    ```typescript
        // request（如有需要配合该项目的服务端则需要一致）
        {
            url: '/upload/largeCheck'       // 用于配合该项目的服务端地址
            method: 'GET',                  // 上传方式
            fileHash: string,               // 文件哈希值
        }

        // response (返回的数据需要保持一致)
        {
            fileHash : string,              // 文件哈希值
            uploadedChunks : number[],      // 索引数组集合 
        }
    ```
    <a id="merge"></a>
    - `merge` - 分片合并地址
    ```typescript
        // request（如有需要配合该项目的服务端则需要一致）
        {
            url: '/upload/largeMerge'       // 用于配合该项目的服务端地址
            method: 'POST',                 // 上传方式
            fileHash ： string,             // 文件哈希值
            fileName ： string              // 文件名
        }

        // response (返回的数据需要保持一致)
        {
            originalname: string,           // 原始文件名
            mimetype: string,               // 文件的 MIME 类型
            suffixType: string,             // 扩展名
            destination: string,            // 文件存放的目录
            fileName: string,               // 文件名
            path: number,                   // 文件的完整路径
            size: string                    // 文件大小
        }
    ```
    <a id="second"></a>
    - `second` - 秒传地址
    ```typescript
        // request（如有需要配合该项目的服务端则需要一致）
        {
            url: '/upload/largeSecond'      // 用于配合该项目的服务端地址
            method: 'GET',                  // 上传方式
            fileHash ： string,             // 文件哈希值 
        }

        // response (-)                     //任意返回
    ```
    <a id="timeout"></a>
    - `timeout` - 统一设置所有相关地址的超时时间


<h4 id="uploadOptions">uploadOptions (上传配置)</h4>  

<table style="text-align: left;">
  <tr>
    <th>参数名</th> 
    <th>类型</th>
    <th>默认值</th>
    <th>说明</th>
    <th>必传</th>
  </tr>
  <tr>
    <td>webkitdirectory</td>
    <td>String | Boolean</td>
    <td>false</td>
    <td>是否支持webkit目录上传</td>
    <td>否</td>
  </tr>
  <tr>
    <td>directory</td>
    <td>String | Boolean</td>
    <td>false</td>
    <td>是否支持目录上传（建议同开启webkitdirectory）</td>
    <td>否</td>
  </tr>
  <tr>
    <td>accept</td>
    <td>String | String[]</td>
    <td>*</td>
    <td>上传的文件类型（默认允许所有类型）</td>
    <td>否</td>
  </tr>
  <tr>
    <td>multipleNum</td>
    <td>String | Number</td>
    <td>-</td>
    <td>multiple开启时，允许的最大文件数量</td>
    <td>否</td>
  </tr>
  <tr>
    <td>multiple</td>
    <td>Boolean</td>
    <td>false</td>
    <td>是否开启多传</td>
    <td>否</td>
  </tr>
  <tr>
    <td>chunkSize</td>
    <td>Number</td>
    <td>3MB</td>
    <td>分片大小，单位为字节</td>
    <td>toggleLargefile开启时</td>
  </tr>
   <tr>
    <td>maxFileUploads</td>
    <td>Number</td>
    <td>3</td>
    <td>最大并发文件上传数量</td>
    <td>toggleLargefile开启时</td>
  </tr>
  <tr>
    <td>maxFileChunksUploads</td>
    <td>Number</td>
    <td>3</td>
    <td>最大并发分片上传数量</td>
    <td>toggleLargefile开启时</td>
  </tr>
  <tr>
    <td>compressionOptions</td>
    <td>Object</td>
    <td>
        <a href="https://www.npmjs.com/package/browser-image-compression" target="_blank">文档跳转</a>
    </td>
    <td>browser-image-compression插件的压缩图片参数</td>
    <td>toggleCompressionImg开启时</td>
  </tr>
</table>

 browser-image-compression所有属性参数
```typescript
const options: Options = { 
  maxSizeMB: number,            // （默认值: Number.POSITIVE_INFINITY）允许的图片最大体积（单位：MB）
  maxWidthOrHeight: number,     // 压缩后的图片会按比例缩放，直至宽度或高度小于此值（默认: undefined）
                                // 注意：浏览器对 Canvas 的最大尺寸有限制，实际结果可能会自动调整到浏览器支持的范围。
                                // 详见文档中的“注意事项”部分。
  onProgress: Function,         // 可选，进度回调函数，参数为当前进度百分比（0 到 100）
  useWebWorker: boolean,        // 可选，是否启用多线程 Web Worker，若不支持则退回主线程运行（默认: true）
  libURL: string,               // 可选，用于在 Web Worker 中导入脚本的库地址（默认: CDN 链接）
  preserveExif: boolean,        // 可选，是否保留 JPEG 的 Exif 元数据（如相机型号、焦距等，默认: false）
  signal: AbortSignal,          // 可选，用于中断/取消压缩的 AbortSignal 对象

  // 以下为高级选项
  maxIteration: number,         // 可选，压缩的最大迭代次数（默认: 10）
  exifOrientation: number,      // 可选，EXIF 方向信息，参考 https://stackoverflow.com/a/32490603/10395024
  fileType: string,             // 可选，强制指定输出文件类型（如 'image/jpeg', 'image/png'，默认: 原始类型）
  initialQuality: number,       // 可选，初始压缩质量（0 到 1，默认: 1）
  alwaysKeepResolution: boolean // 可选，仅降低质量，始终不改变宽高（默认: false）
}
```

#### 功能开关
- `toggleLargefile` - 是否启用大文件上传
- `toggleCompressionImg` - 是否启用图片压缩 (toggleLargefile 关闭情况下)


<h3 id="propsAttribute">UploadContainer propsAttribute回调属性</h3>

```typescript
<UploadContainer
    {...传入相关参数配置}
>
{(propsAttribute) => (
    用户展示组件
    const {
      fileStartUpload,
      filePausedUpload,
      getResources,
      ...
   } = propsAttribute
)}

</UploadContainer>
```
<table style="text-align: left;">
    <tr>
        <th>属性名</th> 
        <th>类型</th> 
        <th>说明</th> 
    </tr>
    <tr>
        <td>fileStartUpload</td>
        <td>
            <a href="#fileStartUpload">prop callBack</a>
        </td> 
        <td>上传文件成功后返回的数据</td> 
    </tr>
    <tr>
        <td>filePausedUpload</td>
        <td>
            <a href="#filePausedUpload">prop promise</a>
        </td> 
        <td>正在上传时可暂停文件的方法</td> 
    </tr>
    <tr>
        <td>getResources</td>
        <td>
            <a>prop callBack</a>
        </td> 
        <td>
            获取所有已上传的文件数据
            <a href="https://github.com/kochey-wgq/q-upload-server">（需配合该项目的服务端）</a>
        </td> 
    </tr> 
</table>

 
<h4 id="fileStartUpload">fileStartUpload</h4>

```typescript
fileStartUpload({
    data: files, // FileList源文件数据
    onProgress: async (ProgressData: unknown) => {  //正在上传时
        console.log(ProgressData, '正在上传数据')
        const findFiles = files.map(async (item:File) => {
            // 大文件上传
            if (toggleLargefile) {  //是否开启大文件
                const { fileInfo } = ProgressData
                const { progress, status, file } = fileInfo
                if (file.name === item.name) {

                    item.progress = progress
                    item.status = status
                }
            } else { // 小文件上传
                const { status, percentage, file } = ProgressData
                if (file.name === item.name) {
                    item.progress = percentage
                    item.status = status

                }
            }
            return item
        })
        const newFiles = await Promise.all(findFiles)
        setFiles(newFiles);

    },
    result: (data: any) => {
        console.log(data, '上传完成后') 
    }
});
```

#### ProgressData 参数回调

小文件非分片上传：
- `axiosOrgProgress` -axios response 返回的数据
- `file` - 当前上传的源文件
- `fileHash` - 文件哈希值
- `status` - 上传状态
- `percentage` - 上传进度百分比
- `progressType` - 进度类型 (upload/download)

大文件分片上传：
- `apiRes` -axios response 返回的数据
- `fileInfo` - 当前上传的文件信息
```typescript
fileInfo : {
    "file": { 
        "progress": number,    //进度百分比
        "status": string       //状态
        ...
    },
    "progress": number,     //进度百分比
    "status": string,       //状态
    "uploadedBytes": 15487003,
    "fileHash": string,     //文件哈希
    "merged": boolean       //是否所有分片上传完成并合并完成         
    ...
}
```

<h4 id="filePausedUpload">filePausedUpload </h4>

```typescript

const res = await filePausedUpload(files)  //源文件参数
res : [{    
    "progress": number,    //进度百分比
    "status": string       //状态
    ...
    ...
}]
```

## 核心方法

### 1. fileStartUpload - 文件上传

主要功能：
- 文件类型校验
- 文件数量校验  
- 图片压缩处理
- 大文件/小文件上传分发
- 进度回调处理

### 2. filePausedUpload - 暂停上传 

支持暂停单个文件或批量文件的上传。

### 3. getResources - 获取资源  

获取blob资源并转换为可访问的URL。

## 工具函数

### 1. 文件类型校验 (validateFiles)

支持多种文件类型规则：
- MIME类型匹配
- 文件扩展名匹配
- 通配符匹配 (如 image/*)

### 2. 文件哈希计算 (getFileHash)

使用 SHA-256 算法计算文件哈希值，作为文件唯一标识。

### 3. 图片压缩 (compressionImg) 

基于 browser-image-compression 库实现图片压缩功能。

## Web Worker 支持

### 文件切片处理 (createFileChunks.ts) 

使用 Web Worker 进行文件切片处理，避免阻塞主线程，支持：
- 文件分片切割
- 已上传分片过滤
- 断点续传支持

## HTTP 请求处理

### 请求拦截器和响应处理

提供完整的HTTP请求封装，包括：
- 请求/响应拦截器
- 上传/下载进度处理
- 错误处理
- 业务状态码配置



## 构建配置

项目使用 Vite 构建，支持：
- ES 和 UMD 两种输出格式
- TypeScript 类型定义生成
- 外部依赖排除 (react, react-dom)
- Source Map 生成

## Notes

该项目是一个专注于逻辑封装的文件上传组件库，具有以下特点：

1. **纯逻辑组件** - 不提供UI，完全由用户自定义界面
2. **功能完整** - 支持小文件、大文件、分片上传、断点续传等
3. **类型安全** - 完整的 TypeScript 类型定义
4. **性能优化** - Web Worker 处理文件切片，避免阻塞主线程
5. **灵活配置** - 支持多种上传模式和参数配置
6. **已发布至 NPM** - 可直接安装使用

该库特别适合需要自定义上传界面但又希望复用上传逻辑的项目场景。


## 联系作者

<img src="./kochey.jpg" alt="微信号：KoChey0127" width="100" />
