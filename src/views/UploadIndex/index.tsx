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
   const handleFileSelect = () => {
      if (fileInputRef.current) {
         fileInputRef.current.click();
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
         console.log('Fetched data:', data);
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
      let res = await fetchData();
   }
   const handleFileChange = async (event: any) => {
      
      triggerFileSelect({
         event,
         onProgress: (progress: any) => {
            console.log(progress, '上传进度')
            sP(progress.percentage)
         },
         result: (data: any) => {
            console.log(data, '上传result')
            setTimeout(() => {
               sP(0)
            }, 500);
         }
      });
   };

   const getResource = async (fileName: string): Promise<any> => {
      const resResource = await getBlob({
         baseURL: 'http://localhost:3000',
         url: '/upload',
         method: 'get',
         params: {
            fileName
         }
      })
      return resResource
   }
   return (
      <div className={styles.uploadContainer}>
         <div className={styles.uploadArea}>
            <div className={styles.uploadIcon}>
               <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
               >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
               </svg>
            </div>
            <h2 className={styles.uploadTitle}>拖放文件到这里上传</h2>
            <span>上传进度：{p} %</span>
            <p className={styles.uploadDescription}>
               或者
               <span className={styles.uploadButton} onClick={handleFileSelect}>
                  点击选择文件
               </span>
            </p>
            <p className={styles.uploadHint}>支持 JPG、PNG、PDF 格式，最大文件大小 5MB</p>
         </div>
         <input
            type="file"
            name="files"
            multiple={uploadOptions?.multiple || false}
            accept={uploadOptions?.accept?.join(',')}
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
         />
         <div className={styles.exampleImages}>
            <div className={styles.imagePreview}>
               <img
                  src="https://via.placeholder.com/150"
                  alt="示例图片"
                  className={styles.image}
               />
            </div>
            <div className={styles.imagePreview}>
               <img
                  src="https://via.placeholder.com/150"
                  alt="示例图片"
                  className={styles.image}
               />
            </div>
         </div>
      </div>
   );
};

export default UploadComponent;