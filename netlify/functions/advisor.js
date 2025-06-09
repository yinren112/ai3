// netlify/functions/advisor.js (最终优化版)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { books, audience } = JSON.parse(event.body);
    if (!books || !audience) {
      return { statusCode: 400, body: JSON.stringify({ error: '书籍信息和目标人群都不能为空' }) };
    }

    const systemPrompt = `
      ## 一、任务设定和方向引导
      你是一个高效的AI书签广告投放分析工具。你的核心任务是根据用户提供的书籍列表和广告目标人群，快速分析并以高度结构化的格式，返回一个简洁的投放建议列表。你的回答必须绝对遵循预设的输出格式，不要添加任何额外的对话或解释。

      ## 二、具体任务步骤
      1.  解析用户输入，识别出每一本书和其简介。
      2.  分析每本书的潜在读者画像。
      3.  对比读者画像和用户给出的“广告目标人群”。
      4.  为每本书计算一个“匹配度”分数（高、中、低）。
      5.  筛选出匹配度为“高”或“中”的书籍。
      6.  严格按照【五、输出要求】的格式生成结果。

      ## 三、样本示例
      如果用户输入：
      -   书籍: "三体: 硬科幻小说", "百年孤独: 魔幻现实主义文学"
      -   目标人群: "科幻爱好者"
      那么你的输出应该是：
      [
        {
          "book_name": "三体",
          "match_score": "高",
          "reason": "本书是科幻小说的代表作，其读者与科幻爱好者高度重合。"
        }
      ]

      ## 四、注意事项
      -   只输出匹配度为“高”或“中”的书籍，完全不匹配（“低”）的书籍不要出现在结果中。
      -   推荐理由(reason)必须非常简洁，控制在50个字以内，点出核心匹配点即可。
      -   如果没有任何书籍匹配，请返回一个空数组 \`[]\`。
      -   最终输出必须是合法的 JSON 数组格式。

      ## 五、输出要求和思维链引导
      你的最终输出必须是一个 JSON 数组，其中每个对象代表一本推荐的书籍，且只包含以下三个字段：\`book_name\`, \`match_score\`, \`reason\`。不要添加任何在这之外的解释、标题或总结。
      (思维链引导: 用户输入 -> 分析每本书 -> 计算匹配度 -> 过滤掉“低”匹配度的书 -> 构建包含 'book_name', 'match_score', 'reason' 的对象 -> 将所有对象放入一个数组 -> 输出这个 JSON 数组。)
    `;

    const userPrompt = `
      这是我的数据，请根据你的角色和任务，为我提供一份投放建议报告。

      【书籍列表】:
      ${books}

      【我的广告目标人群】:
      ${audience}
    `;

    // --- 关键改动 1: 更换为稳定、快速的主力 Flash 模型 ---
    const modelName = 'gemini-1.5-flash-latest';

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestBody = {
      systemInstruction: { parts: [{ "text": systemPrompt }] },
      contents: [{ parts: [{ "text": userPrompt }] }],
      // 添加一个重要参数，强制 Gemini 输出 JSON
      generationConfig: {
        responseMimeType: "application/json",
      }
    };

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
    
    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error('API did not return any candidates in the response.');
    }
    
    const replyText = responseData.candidates[0].content.parts[0].text;

    // --- 关键改动 2: 直接返回 AI 生成的 JSON 文本 ---
    // AI 被指示直接生成 JSON 字符串，我们直接把它作为响应体返回。
    // 我们需要设置正确的 Content-Type 头，告诉浏览器我们返回的是 JSON。
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: replyText 
    };

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
