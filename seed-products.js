import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEE4db9wu5hARKgfLGnec6FjNyAJtMbQM",
  authDomain: "cantinadigital-93e90.firebaseapp.com",
  projectId: "cantinadigital-93e90",
  storageBucket: "cantinadigital-93e90.firebasestorage.app",
  messagingSenderId: "273991460270",
  appId: "1:273991460270:web:04f02b76a8e43f216b143f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const products = [
  { name: "X-Burger", price: 18.5, category: "Lanches", image: "https://images.unsplash.com/photo-1550547660-d9450f859349", available: true, popularity: 50 },
  { name: "Suco Natural", price: 8, category: "Bebidas", image: "https://images.unsplash.com/photo-1571689936114-b16146eab4a2", available: true, popularity: 90 },
  { name: "Batata Frita", price: 12, category: "Porções", image: "https://images.unsplash.com/photo-1576107232684-1279f390859f", available: false, popularity: 40 },
  { name: "Café", price: 5, category: "Bebidas", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085", available: true, popularity: 75 },
  { name: "X-Salada", price: 21.9, category: "Lanches", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", available: true, popularity: 84 },
  { name: "X-Bacon", price: 24.5, category: "Lanches", image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b", available: true, popularity: 91 },
  { name: "Misto Quente", price: 11.9, category: "Lanches", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af", available: true, popularity: 57 },
  { name: "Coxinha", price: 7.5, category: "Salgados", image: "https://images.unsplash.com/photo-1612203985729-70726954388c", available: true, popularity: 95 },
  { name: "Esfiha de Carne", price: 6.8, category: "Salgados", image: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659", available: true, popularity: 73 },
  { name: "Pastel de Queijo", price: 9.5, category: "Salgados", image: "https://images.unsplash.com/photo-1625937286074-9ca519d5d9df", available: true, popularity: 80 },
  { name: "Refrigerante Lata", price: 6, category: "Bebidas", image: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a", available: true, popularity: 88 },
  { name: "Água Mineral", price: 4.5, category: "Bebidas", image: "https://images.unsplash.com/photo-1564419320408-38e24e038909", available: true, popularity: 62 },
  { name: "Milkshake Chocolate", price: 15.9, category: "Bebidas", image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699", available: true, popularity: 77 },
  { name: "Açaí 500ml", price: 17, category: "Sobremesas", image: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4", available: true, popularity: 86 },
  { name: "Brigadeiro", price: 3.5, category: "Sobremesas", image: "https://images.unsplash.com/photo-1599599810694-b5b37304c041", available: true, popularity: 69 },
  { name: "Pudim", price: 8.9, category: "Sobremesas", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad", available: false, popularity: 52 },
  { name: "Combo Lanche + Refri", price: 29.9, category: "Combos", image: "https://images.unsplash.com/photo-1561758033-7e924f619b47", available: true, popularity: 93 },
  { name: "Combo Família", price: 64.9, category: "Combos", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1", available: true, popularity: 66 },
  { name: "Brownie", price: 9.9, category: "Sobremesas", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476f", available: true, popularity: 78 },
  { name: "Pão de Queijo", price: 5.5, category: "Salgados", image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5", available: true, popularity: 71 },
  { name: "Wrap de Frango", price: 19.9, category: "Lanches", image: "https://images.unsplash.com/photo-1608039755401-742074f0548d", available: true, popularity: 61 },
  { name: "Chá Gelado", price: 7.5, category: "Bebidas", image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e", available: true, popularity: 60 },
  { name: "Mini Pizza", price: 14.9, category: "Salgados", image: "https://images.unsplash.com/photo-1548365328-9f547fb0953b", available: true, popularity: 83 },
  { name: "Salada Caesar", price: 16.9, category: "Fit", image: "https://images.unsplash.com/photo-1546793665-c74683f339c1", available: true, popularity: 58 },
  { name: "Iogurte com Frutas", price: 10.9, category: "Fit", image: "https://images.unsplash.com/photo-1488477181946-6428a0291777", available: true, popularity: 55 }
];

async function run() {
  const beforeSnap = await getDocs(collection(db, "products"));
  console.log(`Produtos antes: ${beforeSnap.size}`);
  for (const product of products) {
    await addDoc(collection(db, "products"), product);
  }
  const afterSnap = await getDocs(collection(db, "products"));
  console.log(`Inseridos: ${products.length}`);
  console.log(`Produtos depois: ${afterSnap.size}`);
}

run().catch((err) => {
  console.error("Erro ao popular produtos:", err);
  process.exitCode = 1;
});
