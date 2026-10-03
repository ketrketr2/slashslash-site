/* サイト掲載用の公開デモ。実際のナヴィ司令室（board）の画面・描画をそのまま使い、
   会話・人物・調査はすべて架空の台本に差し替えている。録音・AI推論・外部通信は行わない。 */
(function(){
 var L=function(s,t){return {speaker:s,text:t}};
 var base={title:'新商品 訴求設計の定例',listening:true,cost_today:null,schedule:[{hm:'14:00',title:'新商品 訴求設計の定例',state:'live',plan:'参加中'},{hm:'16:30',title:'調査設計レビュー',state:'planned',plan:'参加予定'}],
  lanes:{fast:{ago:4},tree:{ago:12},deep:{ago:30},recall:{ago:20}},issues:[],agenda:{decide:['検証する訴求の候補を3つに絞る'],items:['利用場面の整理','次回までの調査設計']},people:[{name:'企画リード',who:'先方・商品企画',last:'前回は価格より利用場面を重視したいと発言',note:'結論を先に聞きたいタイプ'},{name:'調査担当',who:'先方・リサーチ'}]};
 var steps=[
  {topic:{title:'誰の、どんな場面か。',question:'◆ 機能ではなく利用場面から訴求を組み立てられるか',entities:['利用シーン','購入検討層']},
   lines:[L('企画リード','新商品の訴求は、機能より利用場面から考えたい。'),L('SLASH','場面を3つに絞って、反応を比べるのが早いと思います。')],
   say:[{type:'advance',text:'場面を3つに絞り、来週までに反応を比べましょう'}],
   frame:{nodes:[{id:'a',label:'訴求の軸をどこに置くか',kind:'issue'},{id:'b',parent:'a',label:'機能訴求',kind:'note'},{id:'c',parent:'a',label:'利用場面の訴求',kind:'issue'},{id:'d',parent:'c',label:'平日の朝',kind:'evidence'},{id:'e',parent:'c',label:'休日の外出',kind:'evidence'}]},
   research:[{kind:'case',title:'場面起点の訴求事例',body:'利用シーンを主語にした広告は、機能列挙型より記憶に残りやすいとされる（一般論として整理）'},{kind:'kpi',title:'比較に使う指標',body:'想起率／クリック率／検討意向。条件を揃えて比べる'}],
   summary:'訴求の軸を機能から利用場面へ移す方向で議論。場面を3つに絞って比較する案が出た。'},
  {topic:{title:'比較する条件を、揃える。',question:'◆ 平日と休日で反応の違いを公平に比べられるか',entities:['平日','休日','期間']},
   lines:[L('調査担当','まずは平日と休日で、反応の違いを比べてみよう。'),L('SLASH','期間と対象を揃えないと、差が出ても判断できません。')],
   say:[{type:'challenge',text:'対象と期間を揃えないと、差は判断材料になりません'}],
   flags:[{type:'risk',text:'比較期間に大型連休が含まれると、休日の数値が膨らむ'}],
   calc:[{label:'必要サンプル（概算）',expr:'各条件 × 3場面',value:'約1,200'}],
   research:[{kind:'term',title:'比較条件の統制',body:'期間・対象・配信量を揃えて差を見る。片方だけ条件が違うと効果を取り違える'}],
   summary:'平日・休日の比較を実施する方針。期間と対象を揃える必要があると確認。'},
  {topic:{title:'使う場面を、見せる。',question:'◆ 短尺動画で場面を伝えられるか',entities:['短尺動画','配信面']},
   lines:[L('企画リード','広告では、実際に使っている場面を短い動画で見せたい。'),L('SLASH','場面ごとに冒頭2秒の見せ方を変えて試しましょう。')],
   say:[{type:'advance',text:'場面ごとに冒頭2秒を作り分けて検証しましょう'}],
   research:[{kind:'market',title:'短尺動画の視聴傾向',body:'冒頭数秒で離脱が決まりやすい。場面を最初に見せる構成が検討に値する（一般論）'}],
   recall:[{text:'前回、店頭での使用シーンも候補に挙がっていた',when:'前回',where:'定例'}],
   summary:'短尺動画で利用場面を見せる案。冒頭の見せ方を場面ごとに作り分けて検証する。'},
  {topic:{title:'企画を、次の行動へ。',question:'◆ 次回までに何を決めるか',entities:['企画案','検証方法']},
   lines:[L('調査担当','次の打ち合わせで、企画案と検証方法を一緒に確認しよう。'),L('SLASH','企画・制作・検証を同じ表で管理します。')],
   say:[{type:'decide',text:'訴求候補は3つ。次回までに検証設計を一枚にまとめます'}],
   decisions:[{text:'訴求候補を3つの利用場面に絞る',at:'14:32'}],todos:[{text:'検証設計を一枚にまとめる',at:'次回まで'},{text:'場面別の動画構成案を作る',at:'次回まで'}],
   flags:[{type:'commitment',text:'次回までに検証設計を共有する（SLASH）'}],
   summary:'訴求候補を3つの利用場面に絞ることを決定。次回までに検証設計と動画構成案を用意する。'}
 ];
 var acc={lines:[],research:[],flags:[],calc:[],recall:[],decisions:[],todos:[]},i=0;
 function state(k){var s=steps[k],o=JSON.parse(JSON.stringify(base));
  ['lines','research','flags','calc','recall','decisions','todos'].forEach(function(f){if(s[f])acc[f]=acc[f].concat(s[f]);o[f]=acc[f].slice(-12)});
  o.topic=s.topic;o.say=s.say;o.frame=s.frame||steps[0].frame;o.summary=s.summary;o.transcript=acc.lines;var ts=Date.now()/1000;o.research.forEach(function(r){r.ts=r.ts||ts;r.at=r.at||'14:3'+k});return o}
 window.__MOCK__=state(0);
 window.__naviDemoNext=function(){i=(i+1)%steps.length;var st=state(i);st.lanes={fast:{running:true},tree:{ago:2},deep:{running:true},recall:{ago:5}};render(st);setTimeout(function(){st.lanes={fast:{ago:1},tree:{ago:3},deep:{ago:2},recall:{ago:6}};render(st)},1600)};
})();
