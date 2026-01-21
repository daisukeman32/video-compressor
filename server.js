import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, unlinkSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 8080;

// アップロード用ディレクトリ
const uploadDir = join(__dirname, 'uploads');
const outputDir = join(__dirname, 'output');

if (!existsSync(uploadDir)) mkdirSync(uploadDir);
if (!existsSync(outputDir)) mkdirSync(outputDir);

// Multer設定
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const ext = file.originalname.split('.').pop();
        cb(null, `${uniqueName}.${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB制限

// 静的ファイル
app.use(express.static(__dirname));

// 圧縮API
app.post('/compress', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const quality = req.body.quality || 'medium';
    const inputPath = req.file.path;
    const outputFileName = `compressed-${Date.now()}.mp4`;
    const outputPath = join(outputDir, outputFileName);

    // CRF値
    const crfMap = { high: 23, medium: 28, low: 35 };
    const crf = crfMap[quality] || 28;

    const originalSize = statSync(inputPath).size;

    try {
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-c:v libx264',
                    `-crf ${crf}`,
                    '-preset medium',
                    '-c:a aac',
                    '-b:a 128k',
                    '-movflags +faststart'
                ])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        const compressedSize = statSync(outputPath).size;

        res.json({
            success: true,
            originalSize,
            compressedSize,
            downloadUrl: `/download/${outputFileName}`
        });

        // 入力ファイル削除
        unlinkSync(inputPath);

    } catch (error) {
        console.error('Compression error:', error);
        res.status(500).json({ error: 'Compression failed' });
        if (existsSync(inputPath)) unlinkSync(inputPath);
    }
});

// ダウンロード
app.get('/download/:filename', (req, res) => {
    const filePath = join(outputDir, req.params.filename);
    if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, 'compressed_video.mp4', (err) => {
        if (!err) {
            // ダウンロード後に削除
            setTimeout(() => {
                if (existsSync(filePath)) unlinkSync(filePath);
            }, 5000);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
