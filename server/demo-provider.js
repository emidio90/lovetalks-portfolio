const samples = {
  music: ['The soundtrack of a perfect day', 'If today had a soundtrack, which song would open it?', 'Music is an easy way to share a little of your personality.'],
  food: ['A meal worth remembering', 'Which simple meal always feels like a small celebration?', 'Food can turn everyday preferences into warm stories.'],
  travel: ['Take the scenic route', 'Would you rather discover a hidden side street or revisit a favorite place?', 'Imagining a day out invites curiosity without asking for private details.'],
  books: ['A story that stays with you', 'What fictional world would you happily spend an afternoon in?', 'Stories make room for different perspectives and playful imagination.'],
  film: ['Your ideal double feature', 'What two very different films would make a surprisingly good double feature?', 'A film pairing can reveal tastes and spark friendly debate.'],
  nature: ['The art of noticing', 'What small detail outdoors tends to catch your eye?', 'Noticing ordinary things gives a conversation a calm, open starting point.'],
  technology: ['One useful little invention', 'What everyday task would you love a tiny invention to simplify?', 'A practical what-if keeps technology personal and approachable.'],
  art: ['A tiny creative adventure', 'If you could try one creative skill for an afternoon, what would it be?', 'A low-pressure creative question encourages curiosity over expertise.'],
};
const styleQuestions = {
  playful: ['What is the delightfully impractical version of that idea?', 'What would make this a fun afternoon experiment?', 'What unexpected twist would you add?'],
  thoughtful: ['What makes that meaningful to you?', 'Has your preference changed over time?', 'What do you notice that others might miss?'],
  curious: ['What first got you interested in it?', 'What would you recommend to someone new to it?', 'What would you like to explore next?'],
};
export function createDemoProvider() {
  return {
    async topics(preferences) {
      const selected = [...preferences.interests];
      for (const fallback of ['nature', 'art', 'food']) if (selected.length < 3 && !selected.includes(fallback)) selected.push(fallback);
      return {topics: selected.slice(0,3).map(interest => {
        const [title, opener, why] = samples[interest];
        return {title, opener, why};
      })};
    },
    async elaborate(preferences, topic) {
      return {
        insight: `Use “${topic.title}” as an invitation to share a story rather than a test of knowledge. Offer a short example of your own, then leave room for a different answer.`,
        questions: [...styleQuestions[preferences.tone]],
        tip: preferences.setting === 'first-meeting' ? 'Keep it light and give the other person an easy way to change the subject.' : 'Follow the interesting detail in their answer instead of rushing to the next question.',
      };
    },
  };
}
