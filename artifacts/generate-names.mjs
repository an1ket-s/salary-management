import { writeFileSync } from "fs";

const firstNames = [
  // English / American
  "James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles",
  "Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua",
  "Kenneth","Kevin","Brian","George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan",
  "Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Justin","Scott","Brandon",
  "Benjamin","Samuel","Raymond","Gregory","Frank","Alexander","Patrick","Jack","Dennis","Jerry",
  // Female – English / American
  "Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
  "Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna",
  "Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia",
  "Kathleen","Amy","Angela","Shirley","Anna","Brenda","Pamela","Emma","Nicole","Helen",
  "Samantha","Katherine","Christine","Debra","Rachel","Carolyn","Janet","Catherine","Maria","Heather",
  // Hispanic / Latino
  "Carlos","Jose","Juan","Luis","Miguel","Pedro","Antonio","Francisco","Jorge","Manuel",
  "Alejandro","Roberto","Diego","Fernando","Sergio","Pablo","Gabriel","Rafael","Eduardo","Andres",
  "Maria","Ana","Isabel","Sofia","Valentina","Camila","Lucia","Valeria","Daniela","Mariana",
  "Gabriela","Adriana","Fernanda","Paola","Diana","Monica","Alejandra","Claudia","Beatriz","Rosa",
  // African / African-American
  "Darius","Jamal","DeShawn","Malik","Trevon","Marcus","Andre","Darnell","Jerome","Tyrone",
  "Aaliyah","Keisha","Latoya","Shanice","Ebony","Jasmine","Tiffany","Monique","Imani","Destiny",
  "Kwame","Kofi","Ayo","Emeka","Chidi","Obinna","Amara","Adaeze","Chisom","Ngozi",
  // South Asian
  "Raj","Rahul","Arjun","Vikram","Priya","Anjali","Kavya","Pooja","Neha","Divya",
  "Amir","Tariq","Zaid","Bilal","Hina","Sana","Ayesha","Fatima","Zara","Nadia",
  "Ravi","Suresh","Deepak","Ankit","Sneha","Meera","Lakshmi","Swati","Rekha","Geeta",
  // East Asian
  "Wei","Jing","Fang","Ming","Ying","Hong","Lei","Xin","Yan","Lin",
  "Yuki","Kenji","Hiroshi","Takeshi","Naomi","Sakura","Haruto","Yuto","Aoi","Ren",
  "Ji","Hyun","Jae","Min","Soo","Young","Eun","Jung","Ha","Seung",
  // European
  "Luca","Marco","Giovanni","Alessandro","Matteo","Lorenzo","Francesco","Giulia","Sofia","Aurora",
  "Pierre","Jean","Louis","Henri","Marie","Claire","Isabelle","Lucie","Camille","Elise",
  "Hans","Klaus","Dieter","Wolfgang","Helga","Ingrid","Brigitte","Monika","Stefan","Andreas",
  "Ivan","Dmitri","Nikolai","Alexei","Natasha","Olga","Tatiana","Irina","Mikhail","Pavel",
  "Erik","Lars","Bjorn","Sven","Ingrid","Astrid","Freya","Sigrid","Gunnar","Leif",
  // Middle Eastern
  "Omar","Ali","Hassan","Yusuf","Ibrahim","Khalid","Samir","Tariq","Layla","Sara",
  "Rania","Hana","Nour","Dina","Lina","Maya","Yasmin","Salma","Reem","Jana",
  // More English
  "Oliver","Noah","Liam","Ethan","Mason","Logan","Lucas","Aiden","Jackson","Carter",
  "Ella","Ava","Mia","Isabella","Olivia","Sophia","Charlotte","Amelia","Evelyn","Abigail",
  "Harper","Luna","Aria","Scarlett","Grace","Chloe","Victoria","Riley","Zoey","Nora",
  "Henry","Owen","Sebastian","Caleb","Nathan","Dylan","Eli","Levi","Isaac","Hunter",
  "Connor","Evan","Aaron","Adrian","Dominic","Landon","Austin","Gavin","Lincoln","Jaxon",
];

const lastNames = [
  // English / American
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Turner","Phillips","Evans","Collins","Edwards","Stewart","Morris","Morales","Murphy","Cook",
  "Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson","Bailey","Reed","Kelly","Howard",
  "Ramos","Kim","Cox","Ward","Richardson","Watson","Brooks","Chavez","Wood","James",
  "Bennett","Gray","Mendoza","Ruiz","Hughes","Price","Alvarez","Castillo","Sanders","Patel",
  // Irish / Scottish
  "Murphy","O'Brien","O'Sullivan","O'Connor","O'Neill","Kennedy","Lynch","Walsh","Flynn","Ryan",
  "Murray","McCarthy","Doyle","Sullivan","Gallagher","Doherty","Carroll","Brennan","Burke","Quinn",
  "MacLeod","MacDonald","Campbell","Stewart","MacKenzie","Robertson","Thomson","Morrison","Fraser","Ross",
  // Italian
  "Ferrari","Russo","Esposito","Bianchi","Romano","Colombo","Ricci","Marino","Greco","Bruno",
  "Gallo","Conti","De Luca","Mancini","Costa","Giordano","Rizzo","Lombardi","Moretti","Barbieri",
  // German
  "Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann",
  "Schäfer","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann",
  // French
  "Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau",
  "Simon","Laurent","Lefebvre","Michel","Garcia","David","Bertrand","Roux","Vincent","Fournier",
  // Spanish / Hispanic
  "González","Rodríguez","Fernández","López","Martínez","Sánchez","Pérez","Gómez","Díaz","Jiménez",
  "Moreno","Álvarez","Romero","Alonso","Gutiérrez","Navarro","Torres","Domínguez","Vásquez","Ramos",
  // Asian
  "Wang","Li","Zhang","Liu","Chen","Yang","Huang","Zhao","Wu","Zhou",
  "Tanaka","Yamamoto","Suzuki","Watanabe","Ito","Nakamura","Kobayashi","Kato","Saito","Inoue",
  "Park","Choi","Jung","Kang","Cho","Yoon","Jang","Lim","Han","Shin",
  "Nguyen","Tran","Le","Pham","Hoang","Phan","Vu","Dang","Bui","Do",
  // South Asian
  "Patel","Sharma","Singh","Kumar","Gupta","Shah","Mehta","Joshi","Nair","Reddy",
  "Rao","Malhotra","Verma","Sinha","Pillai","Iyer","Bose","Das","Dutta","Chatterjee",
  "Khan","Ahmed","Ali","Hassan","Hussain","Sheikh","Siddiqui","Ansari","Qureshi","Malik",
  // African
  "Okafor","Obi","Adeyemi","Adeleke","Eze","Nwachukwu","Okonkwo","Adesanya","Nwosu","Chukwu",
  "Mensah","Asante","Boateng","Owusu","Amponsah","Asamoah","Antwi","Acheampong","Ofori","Darko",
  "Diallo","Traore","Coulibaly","Konaté","Bah","Camara","Diop","Ndiaye","Fall","Gueye",
  // Eastern European
  "Ivanov","Petrov","Sidorov","Kuznetсov","Popov","Sokolov","Lebedev","Kozlov","Novikov","Morozov",
  "Nowak","Kowalski","Wiśniewski","Wójcik","Kowalczyk","Kamiński","Lewandowski","Zieliński","Woźniak","Szymański",
  // More common English surnames
  "Foster","Powell","Russell","Sullivan","Griffin","Hayes","Myers","Ford","Hamilton","Graham",
  "Sullivan","Wallace","Woods","Cole","West","Jordan","Owens","Reynolds","Fisher","Ellis",
  "Harrison","Gibson","McDonald","Cruz","Marshall","Ortega","Gomez","Murray","Freeman","Wells",
  "Webb","Simpson","Stevens","Tucker","Porter","Hunter","Hicks","Crawford","Henry","Boyd",
  "Mason","Morales","Kennedy","Warren","Dixon","Ramos","Reyes","Burns","Gordon","Shaw",
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generate(pool, count) {
  const lines = [];
  while (lines.length < count) {
    lines.push(...shuffle(pool));
  }
  return lines.slice(0, count).join("\n");
}

writeFileSync("artifacts/first_names.txt", generate(firstNames, 10_000) + "\n");
writeFileSync("artifacts/last_names.txt",  generate(lastNames,  10_000) + "\n");

console.log(`first_names.txt: ${firstNames.length} unique names, 10,000 lines`);
console.log(`last_names.txt:  ${lastNames.length} unique names, 10,000 lines`);
