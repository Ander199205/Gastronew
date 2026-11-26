"""Genera supabase/seed.sql con Casa Lucía (restaurante de ejemplo).
Uso: python3 scripts/make_seed.py > supabase/seed.sql"""
import json

def j(d): return "'" + json.dumps(d, ensure_ascii=False).replace("'", "''") + "'::jsonb"
def s(x): return "'" + x.replace("'", "''") + "'"

CATS = [
 ('vor', {'de':'Vorspeisen','en':'Starters','es':'Entrantes','it':'Antipasti','fr':'Entrées','tr':'Başlangıçlar'}),
 ('pri', {'de':'Suppe, Reis & Pasta','en':'Soup, rice & pasta','es':'Sopa, arroz y pasta','it':'Zuppa, riso e pasta','fr':'Soupe, riz et pâtes','tr':'Çorba, pilav ve makarna'}),
 ('sec', {'de':'Fisch & Fleisch','en':'Fish & meat','es':'Pescado y carne','it':'Pesce e carne','fr':'Poisson et viande','tr':'Balık ve et'}),
 ('des', {'de':'Desserts','en':'Desserts','es':'Postres','it':'Dolci','fr':'Desserts','tr':'Tatlılar'}),
 ('get', {'de':'Getränke','en':'Drinks','es':'Bebidas','it':'Bevande','fr':'Boissons','tr':'İçecekler'}),
]
# key, cat, price, allergens, veg, vat, station, name{}, desc{}
I = [
 ('bru','vor',790,'A',1,7,'kitchen',
  {'de':'Bruschetta'},
  {'de':'Geröstetes Landbrot, Tomaten, frische Kräuter, Olivenöl','en':'Toasted country bread, tomatoes, fresh herbs, olive oil','es':'Pan de pueblo tostado, tomate, hierbas frescas, aceite de oliva','it':'Pane casereccio tostato, pomodori, erbe fresche, olio d’oliva','fr':'Pain de campagne grillé, tomates, herbes fraîches, huile d’olive','tr':'Kızarmış köy ekmeği, domates, taze otlar, zeytinyağı'}),
 ('hum','vor',850,'A,K',1,7,'kitchen',
  {'de':'Hummus mit Pita','en':'Hummus with pita','es':'Hummus con pan de pita','it':'Hummus con pita','fr':'Houmous et pita','tr':'Pide ekmekli humus'},
  {'de':'Kichererbsen, Tahini, Zitrone, Paprika, warmes Fladenbrot','en':'Chickpeas, tahini, lemon, paprika, warm flatbread','es':'Garbanzos, tahini, limón, pimentón, pan plano caliente','it':'Ceci, tahina, limone, paprika, pane piatto caldo','fr':'Pois chiches, tahini, citron, paprika, pain plat chaud','tr':'Nohut, tahin, limon, kırmızı biber, sıcak pide'}),
 ('cap','vor',1090,'G',1,7,'kitchen',
  {'de':'Insalata Caprese'},
  {'de':'Tomaten, Mozzarella, Basilikum, Balsamico','en':'Tomatoes, mozzarella, basil, balsamic','es':'Tomate, mozzarella, albahaca, balsámico','it':'Pomodori, mozzarella, basilico, aceto balsamico','fr':'Tomates, mozzarella, basilic, balsamique','tr':'Domates, mozzarella, fesleğen, balzamik sirke'}),
 ('cro','vor',890,'A,C,G',0,7,'kitchen',
  {'de':'Croquetas de Jamón','es':'Croquetas de jamón'},
  {'de':'Vier hausgemachte Kroketten mit Serranoschinken, Aioli','en':'Four homemade croquettes with Serrano ham, aioli','es':'Cuatro croquetas caseras de jamón serrano, alioli','it':'Quattro crocchette fatte in casa con prosciutto serrano, aioli','fr':'Quatre croquettes maison au jambon serrano, aïoli','tr':'Serrano jambonlu dört ev yapımı kroket, aioli (domuz eti içerir)'}),
 ('kur','pri',750,'G,I',1,7,'kitchen',
  {'de':'Kürbiscremesuppe','en':'Pumpkin cream soup','es':'Crema de calabaza','it':'Vellutata di zucca','fr':'Velouté de potiron','tr':'Balkabağı çorbası'},
  {'de':'Hokkaido-Kürbis, Kürbiskerne, Kürbiskernöl','en':'Hokkaido pumpkin, pumpkin seeds, pumpkin seed oil','es':'Calabaza hokkaido, pipas de calabaza, aceite de pipas','it':'Zucca Hokkaido, semi di zucca, olio di semi di zucca','fr':'Potiron Hokkaido, graines de courge, huile de pépins','tr':'Hokkaido balkabağı, kabak çekirdeği, kabak çekirdeği yağı'}),
 ('ris','pri',1690,'G,I',1,7,'kitchen',
  {'de':'Risotto Parmigiano'},
  {'de':'Carnaroli-Reis, Parmigiano Reggiano, Butter, Kräuter','en':'Carnaroli rice, Parmigiano Reggiano, butter, herbs','es':'Arroz carnaroli, parmigiano reggiano, mantequilla, hierbas','it':'Riso Carnaroli, Parmigiano Reggiano, burro, erbe','fr':'Riz carnaroli, parmigiano reggiano, beurre, herbes','tr':'Carnaroli pirinci, Parmigiano Reggiano, tereyağı, otlar'}),
 ('pes','pri',1390,'A,G,H',1,7,'kitchen',
  {'de':'Penne al Pesto'},
  {'de':'Basilikum-Pesto mit Pinienkernen und Pecorino','en':'Basil pesto with pine nuts and pecorino','es':'Pesto de albahaca con piñones y pecorino','it':'Pesto di basilico con pinoli e pecorino','fr':'Pesto au basilic, pignons et pecorino','tr':'Çam fıstıklı ve pecorinolu fesleğen pesto'}),
 ('pae','pri',2290,'B,D,I,N',0,7,'kitchen',
  {'de':'Paella de Marisco','es':'Paella de marisco'},
  {'de':'Bomba-Reis, Garnelen, Miesmuscheln, Venusmuscheln, Safran. Pro Person, ab 2 Personen','en':'Bomba rice, prawns, mussels, clams, saffron. Per person, for 2 or more','es':'Arroz bomba, gambas, mejillones, almejas, azafrán. Por persona, mínimo 2','it':'Riso bomba, gamberi, cozze, vongole, zafferano. A persona, minimo 2','fr':'Riz bomba, crevettes, moules, palourdes, safran. Par personne, dès 2','tr':'Bomba pirinci, karides, midye, istiridye, safran. Kişi başı, en az 2 kişi'}),
 ('fis','sec',2390,'D,G',0,7,'kitchen',
  {'de':'Fisch vom Grill','en':'Grilled fish','es':'Pescado a la plancha','it':'Pesce alla griglia','fr':'Poisson grillé','tr':'Izgara balık'},
  {'de':'Fang des Tages, Kräuterbutter, Blattsalat','en':'Catch of the day, herb butter, leaf salad','es':'Pesca del día, mantequilla de hierbas, ensalada','it':'Pescato del giorno, burro alle erbe, insalata','fr':'Pêche du jour, beurre aux herbes, salade','tr':'Günün balığı, otlu tereyağı, yeşil salata'}),
 ('lac','sec',2250,'D',0,7,'kitchen',
  {'de':'Lachsfilet vom Grill','en':'Grilled salmon fillet','es':'Salmón a la parrilla','it':'Filetto di salmone alla griglia','fr':'Pavé de saumon grillé','tr':'Izgara somon fileto'},
  {'de':'Mit Gemüsenudeln und Limette','en':'With vegetable noodles and lime','es':'Con tallarines de verdura y lima','it':'Con spaghetti di verdure e lime','fr':'Avec tagliatelles de légumes et citron vert','tr':'Sebze erişte ve misket limonu ile'}),
 ('pul','sec',1990,'N',0,7,'kitchen',
  {'de':'Pulpo a la Gallega','es':'Pulpo a la gallega'},
  {'de':'Gegrillter Oktopus, Kartoffeln, Paprika de la Vera','en':'Grilled octopus, potatoes, smoked paprika','es':'Pulpo, cachelos, pimentón de la Vera','it':'Polpo alla griglia, patate, paprika affumicata','fr':'Poulpe grillé, pommes de terre, paprika fumé','tr':'Izgara ahtapot, patates, isli kırmızı biber'}),
 ('ent','sec',2990,'',0,7,'kitchen',
  {'de':'Entrecôte 300 g','es':'Entrecot 300 g','it':'Entrecôte 300 g','tr':'Antrikot 300 g'},
  {'de':'Vom Grill, mit Pommes frites und Kräutern','en':'Grilled, with fries and herbs','es':'A la brasa, con patatas fritas y hierbas','it':'Alla griglia, con patatine e erbe','fr':'Grillée, frites et herbes','tr':'Izgara, patates kızartması ve otlarla'}),
 ('lam','sec',2690,'',0,7,'kitchen',
  {'de':'Lammkoteletts','en':'Lamb chops','es':'Chuletas de cordero','it':'Costolette d’agnello','fr':'Côtelettes d’agneau','tr':'Kuzu pirzola'},
  {'de':'Rosmarin, Knoblauch, Ofenkartoffeln','en':'Rosemary, garlic, roast potatoes','es':'Romero, ajo, patatas al horno','it':'Rosmarino, aglio, patate al forno','fr':'Romarin, ail, pommes de terre rôties','tr':'Biberiye, sarımsak, fırın patates'}),
 ('hah','sec',1690,'',0,7,'kitchen',
  {'de':'Halbes Brathähnchen','en':'Half roast chicken','es':'Medio pollo asado','it':'Mezzo pollo arrosto','fr':'Demi-poulet rôti','tr':'Yarım fırın tavuk'},
  {'de':'Mit Zitrone und Thymian, dazu Salat','en':'With lemon and thyme, side salad','es':'Con limón y tomillo, con ensalada','it':'Con limone e timo, insalata','fr':'Citron et thym, salade','tr':'Limon ve kekikli, yanında salata'}),
 ('tir','des',750,'A,C,G',1,7,'kitchen',
  {'de':'Tiramisù'},
  {'de':'Mascarpone, Löffelbiskuits, Espresso','en':'Mascarpone, ladyfingers, espresso','es':'Mascarpone, bizcochos, café espresso','it':'Mascarpone, savoiardi, espresso','fr':'Mascarpone, biscuits à la cuillère, espresso','tr':'Mascarpone, kedi dili bisküvi, espresso'}),
 ('cat','des',690,'C,G',1,7,'kitchen',
  {'de':'Crema Catalana','es':'Crema catalana'},
  {'de':'Mit karamellisierter Zuckerkruste','en':'With a caramelised sugar crust','es':'Con costra de azúcar caramelizado','it':'Con crosta di zucchero caramellato','fr':'Croûte de sucre caramélisé','tr':'Karamelize şeker kabuklu'}),
 ('kas','des',720,'A,C,G',1,7,'kitchen',
  {'de':'Käsekuchen','en':'Cheesecake','es':'Tarta de queso','it':'Cheesecake','fr':'Gâteau au fromage','tr':'Cheesecake'},
  {'de':'Cremig gebacken, nach Art des Hauses','en':'Creamy and baked, house recipe','es':'Cremosa y horneada, receta de la casa','it':'Cremosa e cotta al forno, ricetta della casa','fr':'Crémeux et cuit au four, recette maison','tr':'Kremamsı, fırında, ev tarifi'}),
 ('pan','des',690,'G',1,7,'kitchen',
  {'de':'Panna Cotta'},
  {'de':'Mit marinierten Erdbeeren','en':'With marinated strawberries','es':'Con fresas maceradas','it':'Con fragole marinate','fr':'Aux fraises marinées','tr':'Marine çilekli'}),
 ('cho','des',750,'A,C,G,H',1,7,'kitchen',
  {'de':'Schokoladentorte','en':'Chocolate cake','es':'Tarta de chocolate','it':'Torta al cioccolato','fr':'Gâteau au chocolat','tr':'Çikolatalı pasta'},
  {'de':'Dunkle Schokolade, Kirschen','en':'Dark chocolate, cherries','es':'Chocolate negro, cerezas','it':'Cioccolato fondente, ciliegie','fr':'Chocolat noir, cerises','tr':'Bitter çikolata, vişne'}),
 ('ape','get',850,'L',1,19,'bar',
  {'de':'Aperol Spritz'},
  {'de':'Aperol, Prosecco, Soda, Orange','en':'Aperol, prosecco, soda, orange','es':'Aperol, prosecco, soda, naranja','it':'Aperol, prosecco, soda, arancia','fr':'Aperol, prosecco, soda, orange','tr':'Aperol, prosecco, soda, portakal (alkollü)'}),
 ('pel','get',620,'',1,19,'bar',
  {'de':'San Pellegrino 0,75 l'},
  {'de':'Mineralwasser mit Kohlensäure','en':'Sparkling mineral water','es':'Agua mineral con gas','it':'Acqua minerale frizzante','fr':'Eau minérale gazeuse','tr':'Maden suyu'}),
 ('wei','get',690,'L',1,19,'bar',
  {'de':'Rioja Crianza 0,2 l','es':'Rioja crianza 0,2 l'},
  {'de':'Spanischer Rotwein, Tempranillo','en':'Spanish red wine, Tempranillo','es':'Vino tinto, tempranillo','it':'Vino rosso spagnolo, Tempranillo','fr':'Vin rouge espagnol, tempranillo','tr':'İspanyol kırmızı şarabı, Tempranillo'}),
 ('cor','get',290,'',1,19,'bar',
  {'de':'Espresso','en':'Espresso','es':'Café solo','it':'Caffè','fr':'Expresso','tr':'Espresso'},
  {'de':'Aus italienischer Röstung','en':'Italian roast','es':'Tueste italiano','it':'Torrefazione italiana','fr':'Torréfaction italienne','tr':'İtalyan kavrum'}),
]
PHOTO = {'bru':1,'hum':2,'cap':3,'cro':4,'kur':5,'ris':6,'pes':7,'pae':8,'fis':9,'lac':10,'pul':11,'ent':12,'lam':13,'hah':14,'tir':15,'cat':16,'kas':17,'pan':18,'cho':19}

NEAR = [
 ('bar','Bar Ritmo',{'de':'Cocktailbar mit Terrasse, bis 2 Uhr','en':'Cocktail bar with terrace, open until 2 am','es':'Coctelería con terraza, hasta las 2','it':'Cocktail bar con terrazza, fino alle 2','fr':'Bar à cocktails avec terrasse, jusqu’à 2 h','tr':'Teraslı kokteyl bar, gece 2’ye kadar'},250,{'de':'1 Gratis-Shot mit Ihrer Casa-Lucía-Rechnung','en':'1 free shot with your Casa Lucía bill','es':'1 chupito gratis con tu cuenta de Casa Lucía','it':'1 shot gratis con il conto di Casa Lucía','fr':'1 shot offert avec votre addition Casa Lucía','tr':'Casa Lucía hesabınızla 1 ücretsiz shot'}),
 ('music','Jazzkeller Heilbronn',{'de':'Live-Jazz ab 21 Uhr','en':'Live jazz from 9 pm','es':'Jazz en directo desde las 21 h','it':'Jazz dal vivo dalle 21','fr':'Jazz live dès 21 h','tr':'Saat 21’den itibaren canlı caz'},600,None),
 ('cinema','Kino am Neckar',{'de':'Letzte Vorstellung 22:15 Uhr','en':'Last screening 10:15 pm','es':'Última sesión 22:15','it':'Ultimo spettacolo 22:15','fr':'Dernière séance 22 h 15','tr':'Son seans 22:15'},800,None),
 ('market','Wochenmarkt Marktplatz',{'de':'Samstag 7–13 Uhr, regionale Produkte','en':'Saturday 7 am–1 pm, local produce','es':'Sábado 7–13 h, producto local','it':'Sabato 7–13, prodotti locali','fr':'Samedi 7 h–13 h, produits locaux','tr':'Cumartesi 7–13, yerel ürünler'},400,None),
]

out = ["-- Casa Lucía: restaurante de ejemplo (generado con scripts/make_seed.py)",
"-- Las fotos son de Unsplash (licencia Unsplash) y están en public/seed/casalucia/.",
"do $$",
"declare r uuid; cid uuid; cats jsonb := '{}'::jsonb; carmen uuid;",
"begin",
"insert into public.restaurants (slug, name, tagline, address, city, imprint, theme, plan) values ('casalucia', 'Casa Lucía', "
 + j({'de':'Mediterrane Küche · Heilbronn','en':'Mediterranean cuisine · Heilbronn','es':'Cocina mediterránea · Heilbronn','it':'Cucina mediterranea · Heilbronn','fr':'Cuisine méditerranéenne · Heilbronn','tr':'Akdeniz mutfağı · Heilbronn'})
 + ", 'Musterstraße 1, 74072 Heilbronn', 'Heilbronn', 'Casa Lucía (Beispiel), Musterstraße 1, 74072 Heilbronn', "
 + j({'primary':'#B4532A','accent':'#2F6B4F','bg':'#FBF6EF','surface':'#FFFFFF','text':'#2A211B','muted':'#7A6A5D','font_heading':'Fraunces','font_body':'Instrument Sans','radius':'16px','mode':'light','logo_letter':'L'})
 + ", 'mesa') returning id into r;",
]
for pos,(k,name) in enumerate(CATS):
    out.append(f"insert into public.menu_categories (restaurant_id, name, position) values (r, {j(name)}, {pos}) returning id into cid; cats := cats || jsonb_build_object('{k}', cid);")
for pos,(k,cat,price,al,veg,vat,st,name,desc) in enumerate(I):
    photo = f"'/seed/casalucia/{k}.webp'" if k in PHOTO else 'null'
    alls = "array[" + ",".join(s(a) for a in al.split(',')) + "]::text[]" if al else "'{}'::text[]"
    out.append(f"insert into public.menu_items (restaurant_id, category_id, name, description, price_cents, vat_rate, allergens, vegetarian, station, photo_url, position) values (r, (cats->>'{cat}')::uuid, {j(name)}, {j(desc)}, {price}, {vat}, {alls}, {'true' if veg else 'false'}, '{st}', {photo}, {pos});")
for pos,(kind,name,desc,dist,offer) in enumerate(NEAR):
    out.append(f"insert into public.nearby_places (restaurant_id, kind, name, description, distance_m, offer, position) values (r, '{kind}', {s(name)}, {j(desc)}, {dist}, {j(offer) if offer else 'null'}, {pos});")
out += [
"insert into public.staff (restaurant_id, display_name, role) values (r, 'Carmen', 'waiter') returning id into carmen;",
"insert into public.staff (restaurant_id, display_name, role) values (r, 'Küche', 'kitchen');",
"insert into public.staff (restaurant_id, display_name, role) values (r, 'Lucía', 'owner');",
"insert into public.tables (restaurant_id, number, seats, waiter_id) select r, n, case when n in (1,2) then 2 when n > 10 then 6 else 4 end, carmen from generate_series(1, 12) n;",
"end $$;",
]
print("\n".join(out))
