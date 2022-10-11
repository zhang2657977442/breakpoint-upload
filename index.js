$(document).ready(() => {
    //提交按钮  
    const submitBtn = $('#submitBtn');

    // 进度条值对应dom     
    const precentDom = $(".precent input")[0];

    // 进度条 
    const precentVal = $("#precentVal");

    // 暂停按钮  
    const pauseBtn = $('#pauseBtn');

    // 每个chunk的大小，设置为1兆  
    const chunkSize = 1 * 1024 * 1024;

    // 获取slice方法，做兼容处理  
    const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;

    // 对文件进行MD5加密(文件内容+文件标题形式)  
    const hashFile = (file) => {
        return new Promise((resolve, reject) => {
            const chunks = Math.ceil(file.size / chunkSize);
            let currentChunk = 0;
            const spark = new SparkMD5.ArrayBuffer();
            const fileReader = new FileReader();

            function loadNext() {
                const start = currentChunk * chunkSize;
                const end = start + chunkSize >= file.size ? file.size : start + chunkSize;
                fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
            }
            fileReader.onload = e => {
                spark.append(e.target.result);
                // Append array buffer        
                currentChunk += 1;
                if (currentChunk < chunks) {
                    loadNext();
                } else {
                    console.log('finished loading');
                    const result = spark.end();

                    // 通过内容和文件名称进行md5加密          
                    const sparkMd5 = new SparkMD5();
                    sparkMd5.append(result);
                    sparkMd5.append(file.name);
                    const hexHash = sparkMd5.end();
                    resolve(hexHash);
                }
            };
            fileReader.onerror = () => { console.warn('文件读取失败！'); };
            loadNext();
        }).catch(err => { console.log(err); });
    }

    // 提交 
    submitBtn.on('click', async () => {
        var pauseStatus = false;
        var nowUploadNums = 0

        // 1.读取文件    
        const fileDom = $('#file')[0];
        const files = fileDom.files;
        const file = files[0];
        if (!file) { alert('没有获取文件'); return; }

        // 2.设置分片参数属性、获取文件MD5值  

        //文件 hash
        const hash = await hashFile(file);

        // 分片总数  
        const blockCount = Math.ceil(file.size / chunkSize);

        // axiosPromise数组    
        const axiosPromiseArray = [];


        // 文件上传    
        const uploadFile = () => {
            const start = nowUploadNums * chunkSize;
            const end = Math.min(file.size, start + chunkSize);

            // 构建表单      
            const form = new FormData();

            // blobSlice.call(file, start, end)方法是用于进行文件分片      
            form.append('file', blobSlice.call(file, start, end));
            form.append('index', nowUploadNums);
            form.append('hash', hash);

            // ajax提交 分片，此时 content-type 为 multipart/form-data      
            const axiosOptions = {
                onUploadProgress: e => {
                    nowUploadNums++;

                    // 判断分片是否上传完成          
                    if (nowUploadNums < blockCount) {
                        setPrecent(nowUploadNums, blockCount);
                        uploadFile(nowUploadNums)
                    } else {

                        // 4.所有分片上传后，请求合并分片文件            
                        axios.all(axiosPromiseArray).then(() => {
                            setPrecent(blockCount, blockCount);

                            // 全部上传完成              
                            axios.post('/file/merge_chunks', { name: file.name, total: blockCount, hash }).then(res => {
                                console.log(res.data, file);
                                pauseStatus = false;
                                alert('上传成功');
                            }).catch(err => { console.log(err); });
                        });
                    }
                },
            };

            // 加入到 Promise 数组中      
            if (!pauseStatus) { axiosPromiseArray.push(axios.post('/file/upload', form, axiosOptions)); }
        }

        // 设置进度条    
        function setPrecent(now, total) { var prencentValue = ((now / total) * 100).toFixed(2) precentDom.value = prencentValue precentVal.text(prencentValue + '%') precentDom.style.cssText = `background:-webkit-linear-gradient(top, #059CFA, #059CFA) 0% 0% / ${prencentValue}% 100% no-repeat` }

        // 暂停    
        pauseBtn.on('click', (e) => {
            pauseStatus = !pauseStatus;
            e.currentTarget.value = pauseStatus ? '开始' : '暂停'
            if (!pauseStatus) { uploadFile(nowUploadNums) }
        }) uploadFile();
    });
})