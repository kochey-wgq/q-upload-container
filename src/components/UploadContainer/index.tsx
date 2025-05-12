
import UploadEventGather from '@/utils/uploadEventGather'
import type { UploadContainerType } from './type'

const UploadContainer: React.FC<UploadContainerType> = (props): React.ReactNode => {
  const {
    children
  } = props

  const uploadEventGather = new UploadEventGather(props)

  const {
    options,
    triggerFileSelect,
    getBlob
  } = uploadEventGather
  //视图组件
  return children({
    ...options,
    triggerFileSelect,
    getBlob, 
  })
}
export default UploadContainer
