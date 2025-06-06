
import styles from './index.module.less';
import tools from '@/common'
const UploadComponent: React.FC<any> = (props): React.ReactNode => {
   const { getFileHash } = tools
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [imgs, setImgs] = useState([])
   const {
      uploadOptions,
      triggerFileSelect,
      getResources
   } = props
   const [files, setFiles] = useState<any>([]);
   const [isDragActive, setIsDragActive] = useState(false);

   const triggerFileInput = () => {
      fileInputRef.current?.click();
   };

   const handleFileChange = (e: any) => {
      if (e.target.files.length > 0) {
         addFiles(e.target.files);


      }
      e.target.value = ''
   };
   // 开启既传既更
   // useEffect(() => { 
   //    if(files.length < 0 ) return
   //    triggerFileSelect({
   //       data: files.filter(t => t.status !== 'done'),
   //       onProgress: async (progress: any) => {
   //          const findFiles = files.map(async (item: any) => {
   //             const key = await getFileHash(item)
   //             if (Object.keys(progress).includes(key)) {
   //                const { status, percentage } = progress
   //                console.log(key, status, percentage, 'files')
   //                item.progress = percentage
   //                item.status = status

   //             }
   //             return item
   //          })
   //          const newFiles = await Promise.all(findFiles)
   //          setFiles(newFiles);
   //          console.log(progress, '上传进度')
   //       },
   //       result: (data: any) => {
   //          console.log(data, '上传result')
   //          getList()
   //       }
   //    });
   // }, [files.length])
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

   const addFiles = (newFiles: any) => {
      const newFileList = Array.from(newFiles).filter((file: any) =>
         !files.some((f: any) =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
         )
      ).map((file: any) => Object.assign(file, {

         progress: 0,
         status: 'pending'
      }));

      setFiles((prev: any) => [...prev, ...newFileList]);
   };

   const clearAll = () => {
      setFiles([]);
   };

   const startUpload = () => {
      if (files.length === 0) {
         alert('请先添加文件');
         return;
      }

      // files.forEach((fileObj, index) => {
      //    simulateUpload(fileObj, index);
      // });

      triggerFileSelect({
         data: files.filter(t => t.status !== 'done'),
         onProgress: async (progress: any) => {
            const findFiles = files.map(async (item: any) => {
               const key = await getFileHash(item)
               if (Object.keys(progress).includes(key)) {
                  const { status, percentage } = progress
                  console.log(key, status, percentage, 'files')
                  item.progress = percentage
                  item.status = status

               }
               return item
            })
            const newFiles = await Promise.all(findFiles)
            setFiles(newFiles);
            console.log(progress, '上传进度')
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
      const listBlob = list.data.map((t: any) => getResource(t.fileName))
      Promise.allSettled(listBlob).then((res: any) => {
         setImgs(res)
      })
   }


   const getResource = async (fileName: string): Promise<any> => {
      const blob = await getResources({
         baseURL: 'http://localhost:3000',
         url: `/upload/${fileName}`,
         method: 'get',
      })
      return blob
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
                     <div className={styles.hanlder}>
                        <button className={`${styles.playUpload} ${styles.btn} ${styles.primary}`}>开始上传</button> 
                        <div
                           className={styles.status}
                           style={{ color: getStatusColor(file.status) }}
                        >
                           {file.status === 'pending' ? '等待上传' : (file.status === 'uploading' ? '上传中...' : '上传完成')}
                        </div>
                     </div>
                  </div>
               ))
            )}
         </div>

         <div className={styles.actions}>
            <button onClick={startUpload} className={`${styles.btn} ${styles.primary}`}>全部上传</button>
            <button onClick={clearAll} className={`${styles.btn} ${styles.secondary}`}>清空列表</button>
         </div>
         <br /><br /><br /><br />

         <div className={styles.exampleImages}>
            {imgs.map((item, index) => (
               <div className={styles.imagePreview} key={index}>
                  <img
                     src={item.value}
                     alt="示例图片"
                     className={styles.image}
                  />
               </div>
            ))}
         </div>
      </div>

   );
};

export default UploadComponent;