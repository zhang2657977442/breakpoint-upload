const Router = require('koa-router');
const multer = require('koa-multer');
const fs = require('fs-extra');
const path = require('path');
const router = new Router();
const { mkdirsSync } = require('../utils/dir');
const uploadPath = path.join(__dirname, 'upload');
const chunkUploadPath = path.join(uploadPath, 'temp');
const upload = multer({ dest: chunkUploadPath });

// 文件上传接口
router.post('/file/upload', upload.single('file'), async (ctx, next) => {
    const { index, hash } = ctx.req.body;
    const chunksPath = path.join(chunkUploadPath, hash, '/');
    if (!fs.existsSync(chunksPath)) mkdirsSync(chunksPath);
    fs.renameSync(ctx.req.file.path, chunksPath + hash + '-' + index);
    ctx.status = 200;
    ctx.res.end('Success');
})

// 合并分片文件接口
router.post('/file/merge_chunks', async (ctx, next) => {
    const { name, total, hash } = ctx.request.body;
    const chunksPath = path.join(chunkUploadPath, hash, '/');
    const filePath = path.join(uploadPath, name);

    // 读取所有的chunks  
    const chunks = fs.readdirSync(chunksPath);

    // 创建存储文件  
    fs.writeFileSync(filePath, '');
    if (chunks.length !== total || chunks.length === 0) {
        ctx.status = 200;
        ctx.res.end('切片文件数量不符合');
        return;
    }
    for (let i = 0; i < total; i++) {

        // 追加写入到文件中    
        fs.appendFileSync(filePath, fs.readFileSync(chunksPath + hash + '-' + i));

        // 删除本次使用的chunk        
        fs.unlinkSync(chunksPath + hash + '-' + i);
    }
    fs.rmdirSync(chunksPath);
    
    // 文件合并成功，可以把文件信息进行入库。  
    ctx.status = 200;
    ctx.res.end('Success');
})