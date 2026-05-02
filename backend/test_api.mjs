(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '2301110636@student.buksu.edu.ph',
        password: 'password123'
      })
    });
    const data = await res.json();
    const token = data.token;
    
    const docsRes = await fetch('http://localhost:5000/api/student/documents', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const docsData = await docsRes.json();
    console.log(JSON.stringify(docsData, null, 2));
  } catch(e) {
    console.error(e);
  }
})();
