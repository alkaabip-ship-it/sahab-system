import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCRMAccessToken } from '@/lib/zoho-crm'

const PROSPECTS = [
  // Bank
  { First_Name: 'Afif',          Last_Name: 'Kalo',            Title: 'Chief Marketing Officer',                          Company: 'ADCB',                                  Industry: 'Banking',      Email: 'afif.k@adcb.com',                               Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Zein',          Last_Name: 'Haddadin',         Title: 'Head of Marketing',                                Company: 'ADCB',                                  Industry: 'Banking',      Email: 'z@adcb.com',                                    Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Houda',         Last_Name: 'Khatib',           Title: 'SVP Head of Events & Sponsorships',                Company: 'First Abu Dhabi Bank (FAB)',             Industry: 'Banking',      Email: 'houda.khatib@bankfab.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Henry',         Last_Name: 'Jakins',           Title: 'SVP Head of Brand & Marketing',                   Company: 'FAB',                                   Industry: 'Banking',      Email: 'h@bankfab.com',                                 Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: '' },
  { First_Name: 'Muna',          Last_Name: 'Al Ghurair',       Title: 'Group Head of Marketing & Comms',                 Company: 'Mashreq Bank',                          Industry: 'Banking',      Email: 'm@mashreq.com',                                 Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: '' },
  { First_Name: 'Nssrin',        Last_Name: 'Khalil',           Title: 'AVP PR & Events Manager',                         Company: 'Mashreq Bank',                          Industry: 'Banking',      Email: 'NssrinK@mashreq.com',                           Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Maitha',        Last_Name: 'Shuaib',           Title: 'Chief Marketing Officer',                          Company: 'Dubai Islamic Bank',                    Industry: 'Banking',      Email: 'm@dib.ae',                                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Lamia',         Last_Name: 'Hariz',            Title: 'Group Head of Marketing & Comms',                 Company: 'ADIB',                                  Industry: 'Banking',      Email: 'lamia.hariz@adib.com',                          Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Mohammed',      Last_Name: 'Ramadan',          Title: 'Marketing Senior Manager',                         Company: 'ADIB',                                  Industry: 'Banking',      Email: 'm@adib.ae',                                     Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Sandeep',       Last_Name: 'Poduval',          Title: 'Head of Marketing',                                Company: 'Commercial Bank of Dubai (CBD)',         Industry: 'Banking',      Email: 'sandeep.poduval@cbd.ae',                        Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Benazir',       Last_Name: 'Poonawala',        Title: 'Brand Marketing & Comms Head',                    Company: 'CBD',                                   Industry: 'Banking',      Email: 'b@cbd.ae',                                      Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: '' },
  { First_Name: 'Zeina',         Last_Name: 'Kassem',           Title: 'Assistant Marketing Manager',                     Company: 'Sharjah Islamic Bank',                  Industry: 'Banking',      Email: 'zeina.kassem@sib.ae',                           Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: '' },
  { First_Name: 'Sachin',        Last_Name: 'Chandna',          Title: 'Group Head of Marketing',                         Company: 'Emirates NBD',                          Industry: 'Banking',      Email: 'sachinc@emiratesnbd.com',                       Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://www.linkedin.com/in/sachin-chandna-1710422' },
  // Automotive
  { First_Name: 'Nizar',         Last_Name: 'Malaeb',           Title: 'Director of Marketing',                           Company: 'Arabian Automobiles (Nissan)',           Industry: 'Automotive',   Email: 'nizar.malaeb@awrostamani.com',                  Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Raghu',         Last_Name: 'Rangaswamy',       Title: 'Digital Marketing Manager',                       Company: 'Arabian Automobiles',                   Industry: 'Automotive',   Email: 'raghu.rangaswamy@awrostamani.com',              Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Natasha',       Last_Name: 'Houston',          Title: 'Head of Marketing',                               Company: 'Al Tayer Group',                        Industry: 'Automotive',   Email: 'nhouston@altayer.com',                          Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Basel',         Last_Name: 'Asfari',           Title: 'Senior Marketing Manager Motors',                 Company: 'Al Tayer Motors',                       Industry: 'Automotive',   Email: 'basfari@altayer.com',                           Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Alexandra',     Last_Name: 'Fayad',            Title: 'Events Manager',                                  Company: 'Al Tayer Motors',                       Industry: 'Automotive',   Email: 'afayad@altayer.com',                            Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Omar Kamal',    Last_Name: 'Omar',             Title: 'National Marketing & Digital Manager Ferrari',    Company: 'Al Tayer Motors',                       Industry: 'Automotive',   Email: 'oomar@altayer.com',                             Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Ziad',          Last_Name: 'Boghdady',         Title: 'Director of Marketing & Customer Lifecycle',      Company: 'AGMC (BMW)',                            Industry: 'Automotive',   Email: 'ziad.boghdady@agmc.ae',                         Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Jill',          Last_Name: 'Dsilva',           Title: 'Manager Events & Experiential',                   Company: 'AGMC (BMW)',                            Industry: 'Automotive',   Email: 'dsilva-jill@bmw-dubai.com',                     Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: '' },
  { First_Name: 'Eyad',          Last_Name: 'Hawarneh',         Title: 'Marketing & Comms Manager',                       Company: 'AGMC',                                  Industry: 'Automotive',   Email: 'eyad.hawarneh@agmc.ae',                         Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Rana',          Last_Name: 'Eyamie',           Title: 'National Marketing Manager Audi',                 Company: 'Al Nabooda Automobiles',                Industry: 'Automotive',   Email: 'rana.eyamie@nabooda-auto.com',                  Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Marijana',      Last_Name: 'Petrovic',         Title: 'Brand Lead Mercedes-Benz',                        Company: 'Emirates Motor Company',                Industry: 'Automotive',   Email: 'marijana.petrovic@emiratesmotorco.ae',          Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  // Hotel
  { First_Name: 'Ralph',         Last_Name: 'Muthaya',          Title: 'Group Director of Events',                        Company: 'Atlantis Dubai',                        Industry: 'Hospitality',  Email: 'ralph.muthaya@atlantisdubai.com',               Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/ralph-muthaya-47256a2b' },
  { First_Name: 'Chiara',        Last_Name: 'Zanin',            Title: 'Events Manager',                                  Company: 'Atlantis The Palm',                     Industry: 'Hospitality',  Email: 'chiara.zanin@atlantisdubai.com',                Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: 'https://ae.linkedin.com/in/chiara-zanin-2477b354' },
  { First_Name: 'Hiba',          Last_Name: 'Zouhri',           Title: 'Sales Manager Groups & Events',                   Company: 'Burj Al Arab',                          Industry: 'Hospitality',  Email: 'hiba.zouhri@jumeirah.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/hiba-zouhri-b570a8189' },
  { First_Name: 'Yassmine',      Last_Name: 'Chmarkh',          Title: 'Lifestyle Event Manager',                         Company: 'Armani Hotel Dubai',                    Industry: 'Hospitality',  Email: 'yassmine.chmarkh@armanihotels.com',             Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/yassmine-chmarkh-55a427171' },
  { First_Name: 'Rajaa',         Last_Name: 'Mouafiq',          Title: 'Events Manager',                                  Company: 'Armani Hotel Dubai',                    Industry: 'Hospitality',  Email: 'rajaa.mouafiq@armanihotels.com',                Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/rajaa-mouafiq-3081a633' },
  { First_Name: 'Elie George',   Last_Name: 'Zgheib',           Title: 'Director of Events Planning & Ops',              Company: 'JW Marriott Marquis Dubai',             Industry: 'Hospitality',  Email: 'elie.zgheib@marriott.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/eliezgheib' },
  { First_Name: 'Karin',         Last_Name: 'Cohen',            Title: 'Multi-Property Director of Marketing',           Company: 'JW Marriott Marquis Dubai',             Industry: 'Hospitality',  Email: 'karin.cohen@marriott.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/karin-forsgren-cohen' },
  { First_Name: 'Mariam',        Last_Name: 'Aziz',             Title: 'Complex Director of Events',                     Company: 'Le Meridien Dubai',                     Industry: 'Hospitality',  Email: 'mariam.aziz@marriott.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/mariam-aziz-092183132' },
  { First_Name: 'Mohit',         Last_Name: 'Mangtani',         Title: 'Director of Sales MICE',                         Company: 'Grand Hyatt Dubai',                     Industry: 'Hospitality',  Email: 'mohit.mangtani@hyatt.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/mohit-mangtani-95013211b' },
  { First_Name: 'Juliana',       Last_Name: 'Khalife Sfair',    Title: 'Director of Event Sales',                        Company: 'InterContinental Dubai Festival City',  Industry: 'Hospitality',  Email: 'juliana.sfair@ihg.com',                         Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/juliana-khalife-sfair-11373216' },
  { First_Name: 'Nanis',         Last_Name: 'Tawfik',           Title: 'Head of Groups & Events',                        Company: 'Sofitel Dubai The Obelisk',             Industry: 'Hospitality',  Email: 'nanis.tawfik@sofitel.com',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: 'https://ae.linkedin.com/in/nanis-tawfik-mba-5b496a18' },
  { First_Name: 'Kholoud',       Last_Name: 'Asha',             Title: 'Cluster Director of Events',                     Company: 'Kempinski Dubai',                       Industry: 'Hospitality',  Email: 'kholoud.asha@kempinski.com',                    Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Laman',         Last_Name: 'Aghazada',         Title: 'Director of Marketing & Comms',                  Company: 'Kempinski Mall of Emirates',            Industry: 'Hospitality',  Email: 'laman.aghazada@kempinski.com',                  Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Cerelle',       Last_Name: 'Gooding',          Title: 'Director of Sales',                              Company: 'Emirates Palace Mandarin Oriental',     Industry: 'Hospitality',  Email: 'tgooding@mohg.com',                             Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Estelle',       Last_Name: 'Pinna',            Title: 'Marketing & Comms Director',                     Company: 'Waldorf Astoria Dubai Palm Jumeirah',   Industry: 'Hospitality',  Email: 'estelle.pinna@waldorfastoria.com',              Lead_Source: 'Cold Outreach', Rating: 'Warm', Description: '' },
  // Real Estate
  { First_Name: 'Abhilash',      Last_Name: 'Nair',             Title: 'Head of Events',                                 Company: 'Aldar Properties',                      Industry: 'Real Estate',  Email: 'abhilash.nair@aldar.com',                       Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Ian',           Last_Name: 'Rollason',         Title: 'SVP Marketing Operations',                       Company: 'Aldar Properties',                      Industry: 'Real Estate',  Email: 'ian.rollason@aldar.com',                        Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Alya',          Last_Name: 'Al Mutawa',        Title: 'Exec Director Brand Comms & Culture',            Company: 'Aldar Properties',                      Industry: 'Real Estate',  Email: 'alya.almutawa@aldar.com',                       Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Emma',          Last_Name: 'Pope',             Title: 'Corporate Director of Lifestyle Events',         Company: 'Emaar Hospitality Group',               Industry: 'Real Estate',  Email: 'emma.pope@emaarhospitality.com',                Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Marwan',        Last_Name: 'Kady',             Title: 'Head of Real Estate Marketing',                  Company: 'Emaar Properties',                      Industry: 'Real Estate',  Email: 'mkady@emaar.ae',                                Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Tina',          Last_Name: 'Schultz',          Title: 'Head of Brand & Marketing Emaar Malls',         Company: 'Emaar Properties',                      Industry: 'Real Estate',  Email: 'tina.schultz@emaar.com',                        Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Mazen',         Last_Name: 'Halabi',           Title: 'Senior Manager Marketing',                       Company: 'Meraas',                                Industry: 'Real Estate',  Email: 'mazen.halabi@meraas.ae',                        Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Ashish',        Last_Name: 'Parakh',           Title: 'Group Chief Sales & Marketing Officer',          Company: 'Sobha Realty',                          Industry: 'Real Estate',  Email: 'ashish.parakh@sobharealty.com',                 Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  // Aviation
  { First_Name: 'Jean-Francois', Last_Name: 'Jeanne',           Title: 'VP Global Sponsorship Marketing & Events',      Company: 'Emirates Airline',                      Industry: 'Aviation',     Email: 'jean-francois.jeanne@emirates.com',             Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Joseph',        Last_Name: 'Alcantara',        Title: 'Marketing Comms Manager',                        Company: 'Emirates Airline',                      Industry: 'Aviation',     Email: 'joseph.alcantara@emirates.com',                 Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  // Technology
  { First_Name: 'Faheem',        Last_Name: 'Ahamed',           Title: 'Group Chief Marketing Officer',                  Company: 'G42',                                   Industry: 'Technology',   Email: 'faheem.ahamed@g42.ai',                          Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Ulviyya',       Last_Name: 'Hasanzade',        Title: 'Senior Director Corporate Comms',                Company: 'G42',                                   Industry: 'Technology',   Email: 'ulviyya.hasanzade@g42.ai',                      Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  // Telecom
  { First_Name: 'Ibrahim',       Last_Name: 'al Nuaimi',        Title: 'VP Brand & Marketing Communication',             Company: 'du Telecom',                            Industry: 'Telecommunications', Email: 'ibrahim.alnuaimi@du.ae',                  Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  // Healthcare
  { First_Name: 'Rahul',         Last_Name: 'Kadavakolu',       Title: 'Group Chief Marketing Officer',                  Company: 'Aster DM Healthcare',                   Industry: 'Healthcare',   Email: 'rahul.kadavakolu@asterdmhealthcare.com',        Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  { First_Name: 'Peter',         Last_Name: 'Menelaou',         Title: 'Chief Marketing & Comms Officer',                Company: 'NMC Healthcare',                        Industry: 'Healthcare',   Email: 'peter.menelaou@nmc.ae',                         Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
  // Retail
  { First_Name: 'Nandakumar',    Last_Name: 'V',                Title: 'Director Global Marketing & Comms',              Company: 'Lulu Group International',              Industry: 'Retail',       Email: 'n@lulugroupinternational.com',                  Lead_Source: 'Cold Outreach', Rating: 'Hot',  Description: '' },
]

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const token = await getCRMAccessToken()
    const CRM_URL = 'https://www.zohoapis.com/crm/v3/Leads'

    const results = { success: 0, failed: 0, errors: [] as string[] }

    // Zoho CRM allows up to 100 records per bulk insert
    for (let i = 0; i < PROSPECTS.length; i += 100) {
      const batch = PROSPECTS.slice(i, i + 100)
      const res = await fetch(CRM_URL, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: batch }),
      })

      const json = await res.json()

      if (!res.ok) {
        results.errors.push(`Batch ${i / 100 + 1}: ${JSON.stringify(json)}`)
        results.failed += batch.length
        continue
      }

      for (const item of json.data ?? []) {
        if (item.code === 'SUCCESS') results.success++
        else {
          results.failed++
          results.errors.push(`${item.details?.api_name ?? '?'}: ${item.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      uploaded: results.success,
      failed: results.failed,
      total: PROSPECTS.length,
      errors: results.errors,
      message: `تم رفع ${results.success} من ${PROSPECTS.length} عميل إلى Zoho CRM`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  return NextResponse.json({ total: PROSPECTS.length, message: `${PROSPECTS.length} عميل محتمل جاهز للرفع` })
}
