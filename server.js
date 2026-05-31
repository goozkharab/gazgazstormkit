// غیرفعال کردن بررسی سخت‌گیرانه SSL برای جلوگیری از خطای گواهی سرور مقصد
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.handler = async (req, context) => {
  const TARGET = process.env.DATA_SOURCE_ENDPOINT;
  
  // ۱. بررسی مسیر برای نمایش صفحه وضعیت
  if (req.url === '/status' || req.url === '/check') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Project Status</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
                .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                .status-ok { color: #2ecc71; font-weight: bold; }
                .info { color: #666; margin-top: 1rem; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Server is <span class="status-ok">ONLINE</span> 🚀</h1>
                <p>پروژه شما در پلتفرم Stormkit با موفقیت در حال اجرا است و از xHTTP پشتیبانی می‌کند.</p>
                <div class="info">Target Endpoint: ${TARGET ? 'Configured ✅' : 'Not Set ❌'}</div>
            </div>
        </body>
        </html>
      `
    };
  }

  if (!TARGET) {
    return {
      statusCode: 500,
      body: 'DATA_SOURCE_ENDPOINT is not defined in Environment Variables.'
    };
  }

  try {
    const targetUrl = new URL(TARGET);
    // بازسازی دقیق آدرس مقصد همراه با تمام مسیرها و کوئری‌ها
    const destinationUrl = `${targetUrl.origin}${req.url}`;

    // بازسازی و تمیزکاری هدرها برای عبور از فایروال سرور مقصد
    const headers = new Headers();
    if (req.headers) {
      for (const [key, value] of Object.entries(req.headers)) {
        if (key !== 'host' && key !== 'connection') {
          headers.set(key, value);
        }
      }
    }
    headers.set("host", targetUrl.hostname);

    // مدیریت بدنه درخواست برای متدهای xHTTP (مثل POST)
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = req.body;
    }

    // ارسال ترافیک به سرور اصلی با fetch بومی و قدرتمند
    const remoteResponse = await fetch(destinationUrl, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual'
    });

    // استخراج هدرهای برگشتی از سرور اصلی
    const responseHeaders = {};
    remoteResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // خواندن بدنه پاسخ به صورت ArrayBuffer برای تضمین عدم تغییر پکت‌های باینری ایکس‌ری
    const responseBody = await remoteResponse.arrayBuffer();

    return {
      statusCode: remoteResponse.status,
      headers: responseHeaders,
      body: Buffer.from(responseBody).toString('base64'),
      isBase64Encoded: true // الزامی در Stormkit برای فرستادن پکت‌های باینری بدون آسیب
    };

  } catch (err) {
    console.error('Stormkit Proxy Error:', err.message);
    return {
      statusCode: 502,
      body: `Proxy Error: ${err.message}`
    };
  }
};