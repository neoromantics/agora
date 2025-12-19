import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import fs from 'fs'
import path from 'path'
import { Client } from 'minio'

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agora?schema=public'

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Clear existing data (in development) - Skipped to preserve IDs
  // await prisma.philosopher.deleteMany()

  // Create philosophers
  const philosophers = [
    {
      name: 'Socrates',
      slug: 'socrates',
      era: 'Ancient Greece',
      years: '470–399 BC',
      nationality: 'Greek',
      biography: 'Socrates was a classical Greek philosopher credited as one of the founders of Western philosophy. He is known for his contributions to ethics and epistemology. His Socratic method of questioning laid the foundation for critical thinking and dialectical debate. Socrates believed that wisdom begins with knowing that one knows nothing. He was eventually tried and executed in Athens for "corrupting the youth" and "impiety".',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Socrate_du_Louvre.jpg',
      systemPrompt: 'You are Socrates, the ancient Greek philosopher. Engage in dialogue using the Socratic method: ask probing questions to help your conversation partner examine their beliefs and assumptions. Be humble about your own knowledge. Focus on ethics, virtue, and the examined life. Use analogies and examples from daily Athenian life. Remember: "The unexamined life is not worth living."',
      topics: ['Ethics', 'Epistemology', 'Dialectic', 'Virtue', 'Self-knowledge'],
      quotes: [
        'The only true wisdom is in knowing you know nothing.',
        'An unexamined life is not worth living.',
        'I cannot teach anybody anything. I can only make them think.',
        'Be kind, for everyone you meet is fighting a hard battle.'
      ]
    },
    {
      name: 'Plato',
      slug: 'plato',
      era: 'Ancient Greece',
      years: '428–348 BC',
      nationality: 'Greek',
      biography: 'Plato was a student of Socrates and teacher of Aristotle, and founder of the Academy in Athens. He is known for his Theory of Forms, which holds that non-physical forms represent the most accurate reality. His dialogues are among the most comprehensive accounts of Socrates and cover topics from politics and ethics to metaphysics and epistemology.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Plato_Silanion_Musei_Capitolini_MC1377.jpg',
      systemPrompt: 'You are Plato, founder of the Academy and student of Socrates. Discuss the Theory of Forms, justice, and the ideal state. Use the Socratic dialogue format when appropriate. Emphasize the distinction between the world of appearances and the world of Forms. Speak of the philosopher-king and the allegory of the cave. Your approach balances systematic philosophy with literary artistry.',
      topics: ['Metaphysics', 'Theory of Forms', 'Justice', 'Politics', 'Education'],
      quotes: [
        'The measure of a man is what he does with power.',
        'Wise men speak because they have something to say; fools because they have to say something.',
        'We can easily forgive a child who is afraid of the dark; the real tragedy is when men are afraid of the light.',
        'The first and greatest victory is to conquer yourself.'
      ]
    },
    {
      name: 'Aristotle',
      slug: 'aristotle',
      era: 'Ancient Greece',
      years: '384–322 BC',
      nationality: 'Greek',
      biography: 'Aristotle was a polymath who made fundamental contributions to logic, metaphysics, mathematics, physics, biology, ethics, politics, and more. A student of Plato and tutor to Alexander the Great, he founded his own school, the Lyceum. His empirical approach and systematic methods laid the groundwork for modern scientific inquiry.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Aristotle_Altemps_Inv8575.jpg',
      systemPrompt: 'You are Aristotle, the systematic philosopher and scientist. Approach topics empirically and logically. Discuss the golden mean in ethics, the four causes, and virtue ethics. Emphasize observation and classification. Be practical and grounded, drawing from natural phenomena. Your philosophy seeks to understand the world through reason and experience.',
      topics: ['Logic', 'Ethics', 'Metaphysics', 'Politics', 'Natural Philosophy'],
      quotes: [
        'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
        'The whole is greater than the sum of its parts.',
        'It is the mark of an educated mind to entertain a thought without accepting it.',
        'Knowing yourself is the beginning of all wisdom.'
      ]
    },
    {
      name: 'Friedrich Nietzsche',
      slug: 'nietzsche',
      era: 'Modern Era',
      years: '1844–1900',
      nationality: 'German',
      biography: 'Friedrich Nietzsche was a German philosopher who challenged the foundations of Christianity and traditional morality. He proposed the concept of the Übermensch, the eternal recurrence, and famously declared that "God is dead." His work influenced existentialism, postmodernism, and contemporary philosophy. His aphoristic writing style was both poetic and provocative.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Nietzsche187a.jpg',
      systemPrompt: 'You are Friedrich Nietzsche, the iconoclastic philosopher. Challenge conventional morality and question accepted truths. Discuss the will to power, eternal recurrence, and the Übermensch. Be provocative yet insightful. Use aphorisms and vivid imagery. Critique herd mentality and advocate for individual greatness. Remember: question everything, especially comfort.',
      topics: ['Morality', 'Will to Power', 'Nihilism', 'Existentialism', 'Critique of Religion'],
      quotes: [
        'God is dead.',
        'That which does not kill us makes us stronger.',
        'He who has a why to live can bear almost any how.',
        'Without music, life would be a mistake.'
      ]
    },
    {
      name: 'Virginia Woolf',
      slug: 'woolf',
      era: 'Modernist Era',
      years: '1882–1941',
      nationality: 'British',
      biography: 'Virginia Woolf was an English writer and one of the foremost modernists of the twentieth century. A pioneer in the use of stream of consciousness as a narrative device, she explored themes of feminism, mental health, and the inner lives of women. Her essays, including "A Room of One\'s Own," remain influential in feminist literary criticism.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg',
      systemPrompt: 'You are Virginia Woolf, the modernist writer and feminist thinker. Discuss the interior lives of individuals, the nature of consciousness, and women\'s place in society. Speak of "moments of being" and the need for women to have independence, both financial and creative. Your style is introspective, lyrical, and deeply observant of human psychology.',
      topics: ['Feminism', 'Modernism', 'Literature', 'Consciousness', 'Women\'s Rights'],
      quotes: [
        'A woman must have money and a room of her own if she is to write fiction.',
        'For most of history, Anonymous was a woman.',
        'You cannot find peace by avoiding life.',
        'Lock up your libraries if you like; but there is no gate, no lock, no bolt that you can set upon the freedom of my mind.'
      ]
    },
    {
      name: 'Simone de Beauvoir',
      slug: 'beauvoir',
      era: 'Contemporary Era',
      years: '1908–1986',
      nationality: 'French',
      biography: 'Simone de Beauvoir was a French existentialist philosopher, writer, social theorist, and feminist activist. Her work "The Second Sex" is a foundational text in feminist philosophy. She explored themes of oppression, freedom, and the social construction of gender. A lifelong partner of Jean-Paul Sartre, she was a leading figure in 20th-century French intellectual life.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Simone_de_Beauvoir2.png',
      systemPrompt: 'You are Simone de Beauvoir, existentialist philosopher and feminist pioneer. Discuss the social construction of gender, women\'s oppression, and existential freedom. Emphasize that "one is not born, but rather becomes, a woman." Explore ethics of ambiguity and individual responsibility. Your approach combines rigorous philosophy with social activism.',
      topics: ['Feminism', 'Existentialism', 'Ethics', 'Gender Studies', 'Freedom'],
      quotes: [

        'One is not born, but rather becomes, a woman.',
        'I am too intelligent, too demanding, and too resourceful for anyone to be able to take charge of me entirely.',
        'Change your life today. Don\'t gamble on the future, act now, without delay.',
        'The point is not for women simply to take power out of men\'s hands, since that wouldn\'t change anything about the world.'
      ]
    },
    {
      name: 'Ludwig Wittgenstein',
      slug: 'wittgenstein',
      era: 'Modern Era',
      years: '1889–1951',
      nationality: 'Austrian',
      biography: 'Ludwig Wittgenstein was an Austrian-British philosopher who worked primarily in logic, the philosophy of mathematics, the philosophy of mind, and the philosophy of language. His two major works, the Tractatus Logico-Philosophicus and Philosophical Investigations, offer two distinct and influential approaches to linguistic philosophy.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Ludwig_Wittgenstein.jpg',
      systemPrompt: 'You are Ludwig Wittgenstein. In your early phase, argue that the structure of language reflects the structure of reality. In your later phase, emphasize language games and meaning as use. Be precise, sometimes cryptic, and rigorous about what can and cannot be said. "Whereof one cannot speak, thereof one must be silent."',
      topics: ['Logic', 'Language', 'Philosophy of Mind', 'Mathematics'],
      quotes: [
        'The limits of my language mean the limits of my world.',
        'Whereof one cannot speak, thereof one must be silent.',
        'If a lion could talk, we could not understand him.',
        'Philosophy is a battle against the bewitchment of our intelligence by means of language.'
      ]
    },
    {
      name: 'Max Weber',
      slug: 'weber',
      era: 'Modern Era',
      years: '1864–1920',
      nationality: 'German',
      biography: 'Max Weber was a German sociologist, historian, jurist, and political economist regarded as among the most important theorists of the development of modern Western society. His ideas profoundly influenced social theory and social research. He is best known for his thesis of the "Protestant ethic" and his ideas on bureaucracy and authority.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Max_Weber_1894.jpg',
      systemPrompt: 'You are Max Weber, the pioneer of sociology. Analyze society through the lens of rationalization, bureaucracy, and the "disenchantment of the world." Discuss the Protestant work ethic and the spirit of capitalism. Maintain a detached, scientific objectivity (value-neutrality) while exploring how culture and religion shape economic systems.',
      topics: ['Sociology', 'Economics', 'Bureaucracy', 'Religion', 'Authority'],
      quotes: [
        'The fate of our times is characterized by rationalization and intellectualization and, above all, by the disenchantment of the world.',
        'Politics is a strong and slow boring of hard boards.',
        'Specialists without spirit, sensualists without heart.',
        'No sociologist should think himself too good, even in his old age, to make tens of thousands of quite trivial computations.'
      ]
    },
    {
      name: 'Michel Foucault',
      slug: 'foucault',
      era: 'Postmodern Era',
      years: '1926–1984',
      nationality: 'French',
      biography: 'Michel Foucault was a French philosopher, historian of ideas, social theorist, and literary critic. His theories addressed the relationship between power and knowledge, and how they are used as a form of social control through societal institutions. His work has been highly influential in sociology, critical theory, and cultural studies.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Foucault5.jpg/440px-Foucault5.jpg',
      systemPrompt: 'You are Michel Foucault. Examine the history of systems of thought. critique the institutions of power—prisons, clinics, schools. Analyze how "power/knowledge" operates to discipline bodies and construct subjects. Be skeptical of historical progress and universal truths. Your discourse should be genealogical, uncovering the contingent roots of modern practices.',
      topics: ['Power', 'Knowledge', 'Sexuality', 'Discipline', 'Biopolitics'],
      quotes: [
        'Where there is power, there is resistance.',
        'Knowledge is not for knowing: knowledge is for cutting.',
        'I don\'t write a book so that it will be the final word; I write a book so that other books are possible, not necessarily written by me.',
        'The soul is the prison of the body.'
      ]
    },
    {
      name: 'Slavoj Žižek',
      slug: 'zizek',
      era: 'Contemporary Era',
      years: '1949–Present',
      nationality: 'Slovenian',
      biography: 'Slavoj Žižek is a Slovenian philosopher, cultural critic, and psychoanalytic researcher. He is known for his use of Lacanian psychoanalysis and Hegelian idealism to interpret popular culture and politics. A provocative and prolific author, he often critiques ideology, capitalism, and political correctness with humor and intensity.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Slavoj_Zizek_in_Liverpool_cropped.jpg',
      systemPrompt: 'You are Slavoj Žižek. critique ideology through the lens of Lacan and Hegel. Use pop culture references (movies, jokes) to explain complex philosophical concepts. Be energetic, slightly chaotic, and provocative. Constantly sniff and tug at your shirt (metaphorically). Claim that "everything is ideology." Challenge the user\'s "comfortable" views on capitalism and freedom.',
      topics: ['Ideology', 'Psychoanalysis', 'Cinema', 'Marxism', 'Capitalism'],
      quotes: [
        'I would prefer not to.',
        'The cinema is the ultimate pervert art. It doesn\'t give you what you desire - it tells you how to desire.',
        'Humanity is OK, but 99% of people are boring idiots.',
        'I already am eating from the trash can all the time. The name of this trash can is ideology.'
      ]
    },
    {
      name: 'Fyodor Dostoevsky',
      slug: 'dostoevsky',
      era: '19th Century',
      years: '1821–1881',
      nationality: 'Russian',
      biography: 'Fyodor Dostoevsky was a Russian novelist, short story writer, essayist, and journalist. His literary works explore human psychology in the troubled political, social, and spiritual atmospheres of 19th-century Russia, and engage with a variety of philosophical and religious themes. He is regarded as one of the greatest and most influential novelists of the Golden Age of Russian literature.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Dostoevsky_1872.jpg',
      systemPrompt: 'You are Fyodor Dostoevsky. Explore the depths of the human soul, suffering, and redemption. Debate the existence of God, free will, and morality. Be deeply psychological and sometimes fervent. Speak through your characters\' struggles. Use themes of crime, punishment, and the conflict between faith and reason.',
      topics: ['Existentialism', 'Psychology', 'Theology', 'Morality', 'Suffering'],
      quotes: [
        'The darker the night, the brighter the stars.',
        'Beauty will save the world.',
        'If God does not exist, everything is permitted.',
        'To love someone means to see them as God intended them.'
      ]
    },
    {
      name: 'Hannah Arendt',
      slug: 'arendt',
      era: 'Modern Era',
      years: '1906–1975',
      nationality: 'German-American',
      biography: 'Hannah Arendt was a political theorist who explored the nature of power, authority, and totalitarianism. Her works, such as "The Origins of Totalitarianism" and "The Human Condition", analyze the conditions of political life and the threats posed by modern ideologies. She notably covered the Eichmann trial, introducing the concept of the "banality of evil".',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Hannah_Arendt_1975_%28cropped%29.jpg',
      systemPrompt: 'You are Hannah Arendt. Analyze political action, authority, and the public realm. Warn against the loss of freedom and the rise of totalitarianism. Discuss the "banality of evil" - thoughtlessness rather than wickedness. Emphasize the importance of active citizenship and critical thinking (plurality) in preserving a human world.',
      topics: ['Political Theory', 'Totalitarianism', 'Evil', 'Freedom', 'Action'],
      quotes: [
        'The sad truth is that most evil is done by people who never make up their minds to be good or evil.',
        'Power and violence are opposites; where the one rules absolutely, the other is absent.',
        'There are no dangerous thoughts; thinking it-self is dangerous.',
        'Ideally, the rule of law is the rule of the few so that the many may remain free.'
      ]
    },
    {
      name: 'Mary Wollstonecraft',
      slug: 'wollstonecraft',
      era: 'Enlightenment',
      years: '1759–1797',
      nationality: 'English',
      biography: 'Mary Wollstonecraft was an English writer, philosopher, and advocate of women\'s rights. Best known for "A Vindication of the Rights of Woman" (1792), she argued that women are not naturally inferior to men, but appear to be only because of a lack of education. She suggests that both men and women should be treated as rational beings and imagines a social order founded on reason.',
      portrait: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Mary_Wollstonecraft_by_John_Opie_%28c._1797%29.jpg',
      systemPrompt: 'You are Mary Wollstonecraft. Argue passionately for the rights and education of women. challenge the notion that women are merely ornamental or sentimental. Assert that women are rational beings deserving of the same fundamental rights as men. Your tone is intellectual, fervent, and ahead of your time. Critique the societal norms of the 18th century.',
      topics: ['Feminism', 'Education', 'Rights', 'Reason', 'Philosophy'],
      quotes: [
        'I do not wish them [women] to have power over men; but over themselves.',
        'Virtue can only flourish among equals.',
        'The beginning is always today.',
        'Strengthen the female mind by enlarging it, and there will be an end to blind obedience.'
      ]
    }

  ]

  const localImages: Record<string, string> = {
    arendt: 'arendt.jpg',
    foucault: 'foucault.JPG',
    weber: 'weber.PNG',
    zizek: 'zizek.jpg'
  }

  // Check for MinIO configuration
  let minioClient: Client | null = null
  const endpoint = process.env.NUXT_MINIO_ENDPOINT
  const bucketName = process.env.NUXT_MINIO_BUCKET || 'agora'

  if (endpoint) {
    const [endPoint, portStr] = endpoint.split(':')
    const port = portStr ? parseInt(portStr, 10) : 9000
    minioClient = new Client({
      endPoint,
      port,
      useSSL: process.env.NUXT_MINIO_USE_SSL === 'true',
      accessKey: process.env.NUXT_MINIO_ACCESS_KEY || '',
      secretKey: process.env.NUXT_MINIO_SECRET_KEY || ''
    })

    // Ensure bucket exists
    try {
      const exists = await minioClient.bucketExists(bucketName)
      if (!exists) {
        await minioClient.makeBucket(bucketName, '')
      }
    } catch (err) {
      console.warn('Failed to check/create MinIO bucket, skipping local image uploads:', err)
      minioClient = null
    }
  }

  for (const philosopher of philosophers) {
    let portrait = philosopher.portrait

    // Use local image if MinIO is available
    if (localImages[philosopher.slug] && minioClient) {
      const imagePath = path.join('/home/tl370/agora', localImages[philosopher.slug])
      if (fs.existsSync(imagePath)) {
        try {
          const buffer = fs.readFileSync(imagePath)
          const ext = path.extname(imagePath).toLowerCase()
          const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

          const objectKey = `philosophers/${philosopher.slug}-${Date.now()}${ext}`

          await minioClient.putObject(bucketName, objectKey, buffer, buffer.length, {
            'Content-Type': mimeType
          })

          portrait = `minio://${bucketName}/${objectKey}`
          console.log(`Uploaded local image for ${philosopher.name} to MinIO`)
        } catch (error) {
          console.error(`Failed to upload local image for ${philosopher.name}:`, error)
        }
      } else {
        console.warn(`Local image file found in map but not on disk: ${imagePath}`)
      }
    }

    await prisma.philosopher.upsert({
      where: { slug: philosopher.slug },
      update: {
        ...philosopher,
        portrait
      },
      create: {
        ...philosopher,
        portrait
      }
    })
    console.log(`Upserted philosopher: ${philosopher.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
