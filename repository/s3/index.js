const s3 = require('./config/aws'),
    utils = require('../../utils/index');

const uploadImage = async (file, path) => {
    const name = utils.ImageNamesConvert(file.originalname);

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${path}/${name}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: 'inline',
    };

    return s3.upload(params).promise();
},
    ImportImageToS3 = async (req, res) => {
        const file = req.file;
        const path = req.body?.path || 'error-path';

        if (!file) {
            console.error('❌ Arquivo não recebido pelo multer');
            return res.status(400).json({ message: 'Arquivo não recebido' });
        }

        try {
            const result = await uploadImage(file, path);
            res.json({ url: result.Location });
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            res.status(500).json({ message: 'Erro no upload' });
        }

    }

module.exports = { uploadImage, ImportImageToS3 };