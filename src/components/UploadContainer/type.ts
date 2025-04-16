export interface UploadContainerType extends UploadEventGatherOptions {
   children: (props: UploadEventGatherOptions | UploadEventGatherType<UploadEventGatherOptions>) => React.ReactNode,
   [propName: string]: unknown
}