import styles from './index.module.less';

const UploadComponent: React.FC<any> = (props): React.ReactNode => {
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [p, sP] = useState(0)
   const [imgs, setImgs] = useState([])
   const {
      uploadOptions,
      triggerFileSelect,
      getBlob
   } = props
   const [files, setFiles] = useState([]);
   const [isDragActive, setIsDragActive] = useState(false);

   const triggerFileInput = () => {
      fileInputRef.current?.click();
   };

   const handleFileChange = (e: any) => {
      if (e.target.files.length > 0) {
         addFiles(e.target.files);
      }
      
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

   const addFiles = (newFiles: any) => {
      console.log(newFiles, 'newFiles')
      const newFileList = Array.from(newFiles).filter((file: any) =>
         !files.some((f: any) =>
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
         )
      ).map((file: any) => Object.assign(file, {

         progress: 0,
         status: '等待上传'
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
         data : files,
         onProgress: (progress: any) => {
            console.log(progress, '上传进度')
            sP(progress.percentage)
         },
         result: (data: any) => {
            console.log(data, '上传result')
            // if(data.httpRes.code === 200){
            //    getList()
            // }
            setTimeout(() => {
               sP(0)
            }, 500);
         }
      });
   };

   const simulateUpload = (fileObj: any, index: any) => {
      const interval = setInterval(() => {
         setFiles(prevFiles => {
            const newFiles = [...prevFiles];
            newFiles[index] = {
               ...newFiles[index],
               progress: Math.min(newFiles[index].progress + Math.random() * 10, 100),
               status: '上传中...'
            };

            if (newFiles[index].progress >= 100) {
               newFiles[index].status = '上传完成';
               clearInterval(interval);
            }

            return newFiles;
         });
      }, 300);
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
         case '上传中...': return '#4a90e2';
         case '上传完成': return '#2ecc71';
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
      const blob = await getBlob({
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
               webkitdirectory={false}
               directory={false}
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
                     <div
                        className={styles.status}
                        style={{ color: getStatusColor(file.status) }}
                     >
                        {file.status}
                     </div>
                  </div>
               ))
            )}
         </div>

         <div className={styles.actions}>
            <button onClick={startUpload} className={`${styles.btn} ${styles.primary}`}>开始上传</button>
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