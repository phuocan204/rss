const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config.json');
const { novels, webhook_url } = config;

const processedChaptersMemory = {};

const parseDate = dateString => {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
};

async function fetchNovelData(novelUrl) {
    const response = await axios.get(novelUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/131.0.2903.86' }
    });
    const $ = cheerio.load(response.data);
    const author = $('span.info-name:contains("Tác giả:")').next('.info-value').find('a').text().trim(); //Lấy name tác giả
    const seriesType = $('.series-type').text().trim(); // Lấy loại truyện

    // Lấy các chương truyện
    const chapters = $('.list-chapters li').map((_, el) => {
        const chapterElement = $(el).find('.chapter-name a');
        const time = $(el).find('.chapter-time').text().trim();
        return {
            name: chapterElement.text().trim(),
            link: `https://ln.hako.vn${chapterElement.attr('href')}`,
            time,
            date: parseDate(time)
        };
    }).get().reverse();
    return { author, seriesType, chapters };
}

async function sendWebhook(chapter, novelName, seriesType, author) {
    try {
        const message = [
            `📘 **Chương mới cập nhật:**`,
            `\`${chapter.name}\``,
            `Tên truyện: ${novelName}`,
            `Tác giả: ${author}`,
            `Loại truyện: ${seriesType}`,
            `Thời gian cập nhật: ${chapter.time}`,
            `🔗 [${novelName}](${chapter.link})`
        ].join('\n');

        await axios.post(webhook_url, { content: message }, { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Lỗi gửi webhook:', error.message);
    }
}

async function checkNovel(novelUrl, novelName, guilien) {
    const { author, seriesType, chapters } = await fetchNovelData(novelUrl);
    const processedChapters = processedChaptersMemory[novelUrl] || [];
    const newChapters = chapters.filter(chap => !processedChapters.some(p => p.link === chap.link));

    if (newChapters.length > 0) {
        const latestChapter = newChapters.sort((a, b) => b.date - a.date)[0];
        await sendWebhook(latestChapter, novelName, seriesType, author);
        processedChaptersMemory[novelUrl] = [...processedChapters, ...newChapters];
    } else if (guilien && processedChapters.length === 0 && chapters.length > 0) {
        await sendWebhook(chapters[0], novelName, seriesType, author);
        processedChaptersMemory[novelUrl] = chapters;
    }
}

(async () => {
    const guilien = true; //true: gửi liền
    for (let { url, name } of novels) {
        await checkNovel(url, name, guilien);
    }
    setInterval(async () => {
        for (let { url, name } of novels) {
            await checkNovel(url, name, false);
        }
    }, 5000); // Kiểm tra cập nhật 5 giây
})();
