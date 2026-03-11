const { db } = require('./src/lib/firebase-admin');

async function seed() {
  try {
    await db.collection('settings').doc('lock').set({
      isLocked: false,
      updatedAt: new Date(),
    }, { merge: true });
    console.log('Successfully seeded lock state to false (unlocked)');
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

seed();
