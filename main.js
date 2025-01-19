const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const { novels, webhook_url } = config;

function loadProcessedChapters(novelUrl) {
    const fileName = `processedChapters_${Buffer.from(novelUrl).toString('base64')}.json`;
    return fs.existsSync(fileName) ? JSON.parse(fs.readFileSync(fileName, 'utf-8')) : [];
}

function luuchuong(novelUrl, chapters) {
    const fileName = `processedChapters_${Buffer.from(novelUrl).toString('base64')}.json`;
    fs.writeFileSync(fileName, JSON.stringify(chapters, null, 2));
}

async function laychuong(novelUrl) {
    try {
        const response = await axios.get(novelUrl, {
            headers: { 'Phuocan204': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/131.0.2903.86' }
        });
        const $ = cheerio.load(response.data);
        const processedChapters = loadProcessedChapters(novelUrl);
        let newChapters = [];

        // Lấy thông tin loại truyện
        const seriesType = $('.series-type').text().trim();

        // Lấy các chương truyện
        $('.list-chapters .chapter-name a').toArray().reverse().forEach(el => {
            const link = $(el).attr('href');
            if (!processedChapters.includes(link)) {
                newChapters.push({ name: $(el).text().trim(), link: `https://ln.hako.vn${link}` });
                processedChapters.push(link);
            }
        });

        luuchuong(novelUrl, processedChapters);

        return { newChapters, seriesType, };
    } catch (error) {
        return { newChapters: [], seriesType: null };
    }
}

async function sendwebhook(newChapters, novelName, seriesType) {
    if (newChapters.length > 0) {
        const message = [
            `📘 **Chương mới cập nhật:** ${newChapters[0].name}`,
            `Tên truyện: ${novelName}`,
            `Loại truyện: ${seriesType}`,
            `🔗 [${novelName}](${newChapters[0].link})`
        ].join('\n');
        };
        await axios.post(webhook_url, payload, { headers: { 'Content-Type': 'application/json' } });
    }

async function kiemtra(novelUrl, novelName) {
    const { newChapters, seriesType } = await laychuong(novelUrl);
    if (newChapters.length > 0) await sendwebhook(newChapters, novelName, seriesType);
}


(async () => {
    for (let { url, name } of novels) {
        await kiemtra(url, name);
    }
    
    setInterval(async () => {
        for (let { url, name } of novels) {
            await kiemtra(url, name);
        }
    }, 5000); // Kiểm tra cập nhật 5 giây
})();
