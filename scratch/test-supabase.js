const url = 'https://ioyqnmvrnpzdztpkgaxt.supabase.co/rest/v1';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlveXFubXZybnB6ZHp0cGtnYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDk2MjksImV4cCI6MjA5NzcyNTYyOX0.A06ba5XCyR7wU2c67YQjgJ8oG2j2fNnEpdf3zvdkT0Y';

const headers = {
  'apikey': anonKey,
  'Authorization': `Bearer ${anonKey}`,
  'Content-Type': 'application/json'
};

async function query(table, select = '*') {
  try {
    const res = await fetch(`${url}/${table}?select=${select}`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      console.log(`Error querying ${table}:`, res.status, errText);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`Fetch error for ${table}:`, e);
    return null;
  }
}

async function run() {
  console.log('Querying kelas...');
  const kelas = await query('kelas');
  console.log('Kelas:', kelas);

  console.log('Querying student limit 3...');
  const students = await query('student', '*');
  console.log('Students:', students ? students.slice(0, 3) : null);

  console.log('Querying permit limit 3...');
  const permits = await query('permit');
  console.log('Permits:', permits ? permits.slice(0, 3) : null);
}

run();
