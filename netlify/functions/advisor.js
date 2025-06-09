// netlify/functions/advisor.js (已更正版本)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { books, audience } = JSON.parse(event.body);
    if (!books || !audience) {
      return { statusCode: 400, body: JSON.stringify({ error: '书籍信息和目标人群都不能为空' }) };
    }

    // --- 1. 定义AI的角色和任务 (System Prompt) ---
    const systemPrompt = `
      你是一名专业的图书市场分析师和广告投放顾问。你的任务是帮助用户决定，他们的书签广告应该投放在哪些书籍中以获得最高效率。

      你的分析步骤如下：
      1.  仔细阅读用户提供的书籍列表（包含书名和简介）。
      2.  根据每本书的内容，精确分析其核心读者群体的特征（例如：年龄、兴趣、职业、价值观等）。
      3.  仔细阅读用户提供的广告目标人群描述。
      4.  将书籍的读者群体与广告目标人群进行匹配度分析。
      5.  输出一份清晰、专业的投放建议报告。

      报告格式要求：
      -   首先，给出一个总体结论。
      -   然后，以列表形式推荐3-5本最匹配的书籍。
      -   对于每一本推荐的书，必须包含以下内容：
          -   **书名**: [书名]
          -   **匹配度评分**: (用“高”、“中”、“低”来评估)
          -   **推荐理由**: (详细解释为什么这本书的读者与广告目标人群高度匹配)
      -   最后，可以简要提及一些不推荐的书籍，并说明原因。
      -   语气要专业、自信、有说服力。
    `;

    // --- 2. 构造完整的用户提问 ---
    const userPrompt = `
      这是我的数据，请根据你的角色和任务，为我提供一份投放建议报告。

      【书籍列表】:
      ${books}

      【我的广告目标人群】:
      ${audience}
    `;

    // --- 3. 设置模型和API ---
    // 使用您指定的 2.5 Pro 预览版模型
    const modelName = 'gemini-2.5-pro-preview-0506'; // <-- 已更正！这里之前误写为 1.5

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // --- 4. 构造请求体，包含系统指令和用户提问 ---
    const requestBody = {
      systemInstruction: {
        parts: [{ "text": systemPrompt }]
      },
      contents: [
        {
          parts: [{ "text": userPrompt }]
        }
      ]
    };

    // --- 5. 发送请求 ---
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        const errorMessage = errorData.error?.message || `Google API Error: ${apiResponse.status}`;
        console.error('API Error:', errorMessage);
        throw new Error(errorMessage);
    }

    const responseData = await apiResponse.json();
    
    // 检查是否有候选回复，防止 API 响应结构问题导致错误
    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error('API did not return any candidates in the response.');
    }
    
    const reply = responseData.candidates[0].content.parts[0].text;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: reply.trim() })
    };

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}