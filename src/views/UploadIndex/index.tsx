
import styles from './index.module.less';
import tools from '@/common' 
import { UploadOutlined } from '@ant-design/icons';
import { Button, Upload } from 'antd';
import type { UploadFile } from 'antd'; 
const UploadComponent: React.FC<any> = (props): React.ReactNode => {
   const { getFileHash } = tools
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [imgs, setImgs] = useState([])
   const {
      uploadOptions,
      fileStartUpload,
      filePausedUpload,
      getResources,
      requestOptions,
      toggleLargefile
   } = props
   const [files, setFiles] = useState<any>([]);
   const [isDragActive, setIsDragActive] = useState(false);
   const filesRef = useRef(files);
   let timer:any = null
   useEffect(() => {
      filesRef.current = files;
   }, [files]);
   const triggerFileInput = () => {
      fileInputRef.current?.click();
   };

   const handleFileChange = (e: any) => {
      console.log(e, '选择文件回调')
      if (e.target.files.length > 0) {
         addFiles(e.target.files);


      }
      e.target.value = '' 
      // clearTimeout(timer)
      // if (e.fileList.length > 0) {
      //    timer = setTimeout(() => {
      //       addFiles(e.fileList.map( t => t.originFileObj));
      //    }, 0);
      // }
   };

   const dragOver = (e: any) => {
      e.preventDefault();
      setIsDragActive(true);
   };

   const dragLeave = () => {
      setIsDragActive(false);
   };

   const handleDrop = (e: any) => {
      e.preventDefault();
      setIsDragActive(false);
      if (e.dataTransfer.files.length > 0) {
         addFiles(e.dataTransfer.files);
      }
   };

   const addFiles = async (newFiles: any) => {
      const filterFileList = Array.from(newFiles).filter((file: any) =>
         !files.some((f: any) =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
         )
      ).map(async (file: any) => {
         const fileHash = await getFileHash(file)
         const progress = localStorage.getItem(`progress-${fileHash}`) || 0;
         const status = progress ? 'paused' : 'pending';
         Object.assign(file, {
            progress,
            status
         })
         return file
      });
      const newFileList = await Promise.all(filterFileList)
      setFiles((prev: any) => [...prev, ...newFileList]);
   };

   const clearAll = () => {
      setFiles([]);
   };
   const paused = async (currentFile?: File) => {
      const res = await filePausedUpload(currentFile ? currentFile : filesRef.current)
      console.log(res, '暂停上传')
      const findFiles = files.map(item => {
         item.status = 'paused'
         return item
      })
      setFiles(findFiles);
   } 

   const startUpload = (currentFile?: File) => {
      if (files.length === 0) {
         alert('请先添加文件');
         return;
      }
      fileStartUpload({
         data: (() => {
            return currentFile ? [currentFile] : files.filter(t => t.status !== 'done')
         })(),
         onProgress: async (data: any) => {
            console.log(data, '上传进度')
            const findFiles = files.map(async (item: any) => {
               // 大文件上传
               if (toggleLargefile) {
                  const { fileInfo } = data
                  const { progress, status, file } = fileInfo
                  if (file.name === item.name) {

                     item.progress = progress
                     item.status = status
                  }
               } else { // 小文件上传
                  const { status, percentage, file } = data
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
            console.log(data, '上传result')
            getList()
         }
      });
   };

   const formatFileSize = (bytes: any) => {
      if (bytes < 0) return "Invalid size";
      if (bytes === 0) return "0 Bytes";

      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
      const value = bytes / Math.pow(k, i);

      // 如果值是整数，省略小数部分
      return value % 1 === 0
         ? `${value} ${sizes[i]}`
         : `${value.toFixed(2)} ${sizes[i]}`;
   };

   const getStatusColor = (status: any) => {
      switch (status) {
         case 'error': return 'red';
         case 'uploading': return '#4a90e2';
         case 'done': return '#2ecc71';
         default: return '#666';
      }
   };

   const fetchData = async () => {
      try {
         const response = await fetch('http://localhost:3000/upload/resources', {
            method: 'GET',
            headers: {
               'Content-Type': 'application/json',
            },
         });
         if (!response.ok) {
            throw new Error('Network response was not ok');
         }
         const data = await response.json();
         return data
      } catch (error) {
         console.error('Error fetching data:', error);
         return error
      }
   };
   useEffect(() => {
      getList()
   }, []);
   const getList = async () => {
      const list = await fetchData();
      const smalls = list.data.smallFiles.map((t: any) => getResource(t.fileName, { type: 'small' }))
      const larges = list.data.largeFiles.map((t: any) => getResource(t.fileName, { type: 'large' }))
      Promise.allSettled([...smalls, ...larges]).then((res: any) => {
         setImgs(res)
      })
   }


   const getResource = async (fileName: string, params: any): Promise<any> => {
      const blob = await getResources({
         baseURL: 'http://localhost:3000',
         url: `/upload/${fileName}`,
         method: 'get',
         params
      })
      return blob
   }


   const renderDom = (item: any) => {
      item = item.value
      if (item.type.includes('image')) {
         return <img src={item.url} alt={item.type} className={styles.image} />
      } else if (item.type.includes('video')) {
         return <video controls>
            <source src={item.url} type={item.type} className={styles.image} />
         </video>
      }
   }

   const fileStatus = (status: string) => {
      console.log(status, 'fileStatus')
      switch (status) {
         case 'uploading':
            return <div className={styles.status}
               style={{ color: getStatusColor(status) }}>上传中</div>
         case 'paused':
            return <div className={styles.status}
               style={{ color: getStatusColor(status) }}>已暂停</div>
         case 'done':
            return <div className={styles.status}
               style={{ color: getStatusColor(status) }}>完成</div>
         case 'error':
            return <div className={styles.status}
               style={{ color: getStatusColor(status) }}>错误</div>
         default:
            return <div className={styles.status}
               style={{ color: getStatusColor(status) }}>等待上传</div>
      }
   }



   const fileList: UploadFile[] = [
      // {
      //    uid: '0',
      //    name: 'xxx.png',
      //    status: 'uploading',
      //    percent: 33,
      // },
      // {
      //    uid: '-1',
      //    name: 'yyy.png',
      //    status: 'done',
      //    url: 'https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png',
      //    thumbUrl: 'https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png',
      // },
      // {
      //    uid: '-2',
      //    name: 'zzz.png',
      //    status: 'error',
      // },
   ];

   const antProp = {
      onRemove: (file) => {
         const index = files.indexOf(file);
         const newFileList = files.slice();
         newFileList.splice(index, 1);
         setFiles(newFileList);
      },
      beforeUpload: (file) => {

         return Promise.reject(false)
      },
      fileList: files,
      multiple : true,
   }
   return (
      <div className={styles.uploadContainer}>
         <h2>文件上传</h2>

         <div
            className={`${styles.uploadArea} ${isDragActive ? styles.active : ''}`}
            onClick={triggerFileInput}
            onDragOver={dragOver}
            onDragLeave={dragLeave}
            onDrop={handleDrop}
         >
            <input
               type="file"
               ref={fileInputRef}
               multiple={uploadOptions?.multiple || false}
               accept={Array.isArray(uploadOptions?.accept) ? uploadOptions?.accept?.join(',') : uploadOptions?.accept}
               webkitdirectory={uploadOptions?.webkitdirectory}
               directory={uploadOptions?.directory}
               onChange={handleFileChange}
               style={{ display: 'none' }}
            />
            <div className={styles.uploadIcon}>📁</div>
            <p>点击或拖拽文件/文件夹到此处</p>
            <p className={styles.hint}>支持多选文件或整个文件夹</p>
         </div>

         <div className={styles.fileList}>
            {files.length === 0 ? (
               <div className={styles.emptyMessage}>暂无文件</div>
            ) : (
               files.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                     <div className={styles.fileInfo}>
                        <span className={styles.fileName} title={file.name}>{file.name}</span>
                        <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                     </div>
                     <div className={styles.progressContainer}>
                        <div
                           className={styles.progressBar}
                           style={{ width: `${file.progress}%` }}
                        ></div>

                     </div>
                     <div>{file.progress}%</div>
                     <div className={styles.hanlder}>
                        <div>
                           <button className={`${styles.playUpload} ${styles.btn} ${styles.primary}`} onClick={() => startUpload(file)}>开始上传</button>
                           &nbsp;&nbsp;&nbsp;
                           <button className={`${styles.playUpload} ${styles.btn} ${styles.secondary}`} onClick={() => paused(file)}>暂停</button>
                        </div>
                        {fileStatus(file.status)}
                     </div>
                  </div>
               ))
            )}
         </div>

         <div className={styles.actions}>
            <button onClick={() => startUpload()} className={`${styles.btn} ${styles.primary}`}>全部上传</button>
            <button onClick={() => paused()} className={`${styles.btn} ${styles.secondary}`}>全部暂停</button>
            <button onClick={clearAll} className={`${styles.btn} ${styles.secondary}`}>清空列表</button>
         </div>
         <br /><br />


         <Upload
            action={requestOptions.baseURL + requestOptions.url}
            listType="picture"
            onChange={handleFileChange}
            {...antProp}
         >
            <Button type="primary" icon={<UploadOutlined />}>
               Upload
            </Button>
         </Upload>
         <Button
            type="primary"
            onClick={() => startUpload()}
            disabled={files.length === 0}
            style={{ marginTop: 16 }}
         >
            Start Upload
         </Button>



         <div className={styles.exampleImages}>
            {imgs.map((item, index) => (
               <div className={styles.imagePreview} key={index}>
                  {renderDom(item)}
               </div>
            ))}
         </div>
      </div>

   );
};

export default UploadComponent;