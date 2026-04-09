require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // 托管前端静态文件

// 通用AI调用函数
async function callDeepSeek(messages, jsonMode = false) {
    const requestBody = {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
    };
    if (jsonMode) {
        requestBody.response_format = { type: "json_object" };
    }
    const response = await axios.post(DEEPSEEK_URL, requestBody, {
        headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }
    });
    return response.data.choices[0].message.content;
}

// 1. AI助教聊天
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const reply = await callDeepSeek([{ role: 'user', content: message }]);
        res.json({ reply });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AI服务异常' });
    }
});

// 2. 智能出题
app.post('/api/generate-question', async (req, res) => {
    try {
        const { subject, difficulty } = req.body;
        const prompt = `你是一个出题专家，并且有着丰富的大学教授经验。请生成一道关于“${subject}”的${difficulty}难度的单选题，要求返回严格的JSON格式，不要有其他文字。格式如下：
{
    "text": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": "正确答案（必须与options中某一项完全一致）",
    "explanation": "解析"
}`;
        const content = await callDeepSeek([{ role: 'user', content: prompt }], true);
        const question = JSON.parse(content);
        question.id = Date.now();
        question.subject = subject;
        question.difficulty = difficulty;
        res.json(question);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '生成题目失败' });
    }
});

// 3. 错题分析
app.post('/api/analyze-mistakes', async (req, res) => {
    try {
        const { mistakes } = req.body;
        if (!mistakes || mistakes.length === 0) {
            return res.json({ analysis: '暂无错题，无法分析。' });
        }
        const mistakesText = mistakes.map(m => 
            `题目：${m.question}\n你的答案：${m.userAnswer}\n正确答案：${m.correctAnswer}\n解析：${m.explanation}`
        ).join('\n\n');
        const prompt = `以下是我的错题记录，请帮我分析薄弱知识点，并给出3条具体的学习建议。\n\n${mistakesText}`;
        const analysis = await callDeepSeek([{ role: 'user', content: prompt }]);
        res.json({ analysis });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '分析失败' });
    }
});

// 4. 学习路线推荐
app.post('/api/roadmap', async (req, res) => {
    try {
        const { quizHistory, mistakes } = req.body;
        const total = quizHistory.length;
        const correct = quizHistory.filter(h => h.correct).length;
        const accuracy = total === 0 ? 0 : (correct / total * 100).toFixed(0);
        const weakSubjects = [...new Set(mistakes.map(m => m.subject))];
        const prompt = `我的学习数据：总答题数${total}，正确率${accuracy}%，薄弱学科：${weakSubjects.join(',') || '无'}。请为我生成一份详细的学习路线，包含每周目标和重点内容。格式用HTML列表展示。`;
        const roadmapHtml = await callDeepSeek([{ role: 'user', content: prompt }]);
        res.json({ roadmapHtml });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '生成路线失败' });
    }
});

app.listen(PORT,'0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});