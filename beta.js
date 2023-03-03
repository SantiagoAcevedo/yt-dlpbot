//
// Start Comand - nodemon --ignore example_db.json beta.js
//
require('dotenv')
const fs = require('fs')
const glob = require('glob');
var validUrl = require('valid-url');
const express = require('express')
const youtubedl = require('youtube-dl-exec')
const { Telegraf } = require('telegraf')
const LocalSession = require('telegraf-session-local')
const { Router, Markup } = Telegraf
const BOT_TOKEN = '1495692552:AAEmcUdPCFBKKEW-fKX8SKTObMl0r9PIeSE';
const app = new Telegraf(BOT_TOKEN);
app.use((new LocalSession({ database: 'example_db.json' })).middleware())

console.log('Iniciando Bot')

const webserver = express()
const port = 8080
const modo_admin = true; // false - Neste modo somente pessoas com a ID definica na array Arr_Aut podem utilizar o bot
const Arr_Aut = ["SUAIDDO CHAT TELEGRAM"]
const LimiteDL = 1024; //IN MB
const LimiteArquivosDia = 10
const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours * 60 minutes * 60 seconds * 1000 milliseconds

webserver.listen(port, () => {
    console.log(`Download Server ativo na porta! ${port}`)
})
webserver.get('/', function (req, res) {
    res.json({
        "status": true,
        "github":"https://github.com/SantiagoAcevedo/yt-dlpbot"
    });
});
webserver.get('/download/:id', function(req, res){
    var fileid = req.params.id;
    glob(__dirname + '/**/arquivos/*_'+fileid.toString()+'.*', {}, (err, files)=>{
        console.log('Alguem vai baixar o arquivo '+files.toString())
        res.download(''+files.toString()+''); // Set disposition and send it.
    })
});
function isYoutubeUrl(url) {
    // Regular expression to match YouTube URLs
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;  
    // Check if the URL matches the regular expression
    return regex.test(url);
}

function terminou(out,id,chatid,msgID){
    glob(__dirname + '/**/*_'+id+'.*', {}, (err, files)=>{
        var stats = fs.statSync(''+files.toString()+'')
        var fileSizeInBytes = stats.size;
        var fileSizeInMegabytes = fileSizeInBytes / (1024*1024);
        if(fileSizeInMegabytes > 50){            
            const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
                Markup.urlButton("🌎 Baixar aquivo", "http://SEUIP:8080/download/"+id),
                Markup.callbackButton("❌ Cancelar", "cancela"),
            ])          
            app.telegram.sendMessage(chatid, 'O video era muito grande, vai ficar disponível no link abaixo',{reply_markup:inlineMessageRatingKeyboard});
        }else{
            app.telegram.sendVideo(chatid, { source: ''+files.toString()+''}).then(function(data){
                console.log('Arquivo enviado na mensagem, o local vai ser apagado')
                fs.unlinkSync(files.toString());
            });
        }
        app.telegram.deleteMessage(chatid, msgID);
    })
}
function erroaobaixar(erro,chatid,msgID){
    app.telegram.editMessageText(chatid,msgID, undefined, 'Infelizmente não consegui baixar seu vídeo, tente outro link');
}
function adiciona_link(url,id,chatid,msgID){
    const pro_dl = youtubedl(url, {
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        //output: '/root/yt/'+id+'_%(title).100s-%(id)s.%(ext)s',
        output: '/root/yt/arquivos/'+chatid+'_'+id+'.%(ext)s',
        addHeader: [
            'referer:google.com',
            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.57'
        ]
    
    })
    pro_dl
    .then(result => {
        terminou(result,id,chatid,msgID)
        console.log(result); // Output: Promise resolved successfully
    })
    .catch(error => {
        erroaobaixar(error,chatid,msgID)
        console.error(error); // Output: Promise rejected with an error
    });
    return true;
}
function pega_info(url,chatid,msgID,msgcomURL){
    if(isYoutubeUrl(url)){
        console.log("url do youtube, aplicar filtros");
        //filtro para remover list da url, somente o w
        const cleanUrl = url.replace(/[?&]list=([^&]+)/, (match, p1) => {
            return match.charAt(0) === '?' ? '?' + p1 : '&' + p1;
        });
        url = cleanUrl;              
    }
    console.log("Pegando informações da url "+url)
    const timeout = 10000; // 30 seconds

    const info_vid = youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
            'referer:google.com',
            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.57'
        ]

    });

    const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {    
        reject(new Error(`Timed out after ${timeout}ms`));
    }, timeout);
    });

    Promise.race([info_vid, timeoutPromise])
    .then(result => {
        console.log(result)
        if((result.filesize_approx / 1000000).toFixed(2) > LimiteDL){
            app.telegram.editMessageText(chatid, msgID, undefined, 'O arquivo é muito grande, com aproximadamente '+(result.filesize_approx / 1000000).toFixed(2)+' MB o limite atual é de '+LimiteDL+' MB!');    
        }else{
            app.telegram.deleteMessage(chatid, msgcomURL);
            app.telegram.deleteMessage(chatid, msgID);
            const buttonMarkup = Markup.inlineKeyboard([
                Markup.callbackButton("✅ Baixar", "dl"),
                // Markup.callbackButton("🚀 Enviar", "dl_envia"),
                Markup.callbackButton("❌ Cancelar", "cancela"),
            ]).extra({
                caption: '🎥 <b>'+result.title+'</b>'+
                '\n✅ <b>Duração: </b><i>'+result.duration_string+'</i> ' +
                '\n✅ <b>Tamanho: </b> <i>'+(result.filesize_approx / 1000000).toFixed(2)+' MB </i> ' +
                '\n🚩 <b>Resolução: </b><i>'+result.resolution+'</i> ',
                parse_mode: 'HTML'
            });
            app.telegram.sendPhoto(chatid, { url: result.thumbnail }, buttonMarkup)     
        }
    })
    .catch(error => {
        const buttonMarkup = Markup.inlineKeyboard([
            // Markup.callbackButton("✅ Tentar Baixar", "dl"),    
            Markup.callbackButton("❌ Cancelar", "cancela"),
        ]).extra();
        app.telegram.editMessageText(chatid, msgID, undefined, 'Infelizmente não consegui pegar informações da url enviada!',buttonMarkup);
        console.error(error); // Output: Promise rejected with an error
    });

}

//app.use(Telegraf.log())

app.catch((err, ctx) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
})
app.action(new RegExp(`^envia_(\\d+)$`), ctx => {
    const id = parseInt(ctx.match[1])
    let r = (Math.random() + 1).toString(36).substring(7);
    adiciona_link(ctx.session.ultimolink.toString(),ctx.session.ultimaID,id,ctx.update.callback_query.message.message_id);
    app.telegram.sendMessage(id, '😉 Voce recebeu um video, ja mando ele aqui!');
    ctx.editMessageText('😉 Tudo bem, vou baixar, e enviar seu video')
})
app.action('del', (ctx) => {
    console.log('apagando tudo de ->'+ctx.callbackQuery.message.chat.id)
    ctx.editMessageText('😉 Vou apagar tudo')
    glob(__dirname + '/**/arquivos/'+ctx.callbackQuery.message.chat.id+'_*.mp4', {}, (err, files)=>{
        if(files.length > 0){
            ctx.replyWithMarkdown('Carregando arquivos!');
            files.forEach(function(value){
                fs.unlinkSync(value.toString());
                ctx.replyWithMarkdown('👍 Apagado!');
            })
        }else{
            ctx.replyWithMarkdown('👍 Nada para apagar!');
        }
    })
})  
app.action('dl', (ctx) => {
    let r = (Math.random() + 1).toString(36).substring(7);    
    if(ctx.update.callback_query.message.photo){
        ctx.telegram.editMessageCaption(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id, undefined, '😉 Tudo bem, vou baixar');
    }else{
        ctx.editMessageText('😉 Tudo bem, vou baixar!')
    }
    ctx.session.ultimaID = r;
    if(typeof ctx.session.Contagem === 'undefined'){
        ctx.session.StartContagem = Date.now();
        ctx.session.Contagem = 1;
    }else{
        ctx.session.StartContagem = Date.now();
        ctx.session.Contagem++;
    }
    console.log(ctx.session.ultimolink.toString())
    adiciona_link(ctx.session.ultimolink.toString(),ctx.session.ultimaID,ctx.update.callback_query.from.id,ctx.update.callback_query.message.message_id);
})

app.action('cancela', (ctx) => {
    if(ctx.update.callback_query.message.photo){
        ctx.telegram.editMessageCaption(ctx.update.callback_query.from.id, ctx.update.callback_query.message.message_id, undefined, '😉 Tá bom');
    }else{
        ctx.editMessageText("😉 Tá bom");  
    }
})
app.command('/start', (ctx) => {
    const isExpired = Date.now() - ctx.session.StartContagem > oneDayInMs;
        const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
            Markup.urlButton("🌎 GitHub", 'https://github.com/SantiagoAcevedo/yt-dlpbot'),
            Markup.urlButton("🌎 Sites Suportados", 'https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md')
        ])
    
        let date = new Date(ctx.session.StartContagem * 1000);
        date.setTime(date.getTime() + 86400000); // 86400000 milliseconds = 1 day
        let newTimestamp = Math.floor(date.getTime() / 1000);
        
        ctx.reply('<b>🤖 Oi! Vou ajudar você a baixar algum vídeo da internet!</b> ' +
            '\n✅ <i>Mande uma URL e deixe comigo 😉</i> ' +
            '\n✅ <i>Sua ID: </i> <code>'+ctx.message.chat.id+'</code>' +
            '\n✅ <i>Atualmente o limite do arquivo é de '+LimiteDL+' MB</i>' +
            (ctx.session.Contagem > 0 ? '\n➡️ Você já baixou '+ctx.session.Contagem+' arquivo(s) hoje o limite diário é de '+LimiteArquivosDia+' arquivos' : '') +         
            '\n❗️️ <i>Vídeos maiores que 50MB serão enviados por URL</i>',{ parse_mode: 'HTML',reply_markup:inlineMessageRatingKeyboard });
 

})
app.command('/id', (ctx) => {
    ctx.replyWithMarkdown('Sua ID: '+ctx.message.chat.id)
})
app.command('/url', (ctx) => {
    ctx.replyWithMarkdown('Os sites compatíveis pode ser consultados em: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md')
})
app.command('/apaga', (ctx) => {
    if(!Arr_Aut.includes(ctx.update.message.from.id)){
        ctx.reply('❌ ID '+chatid+' não autorizada ❌', { reply_to_message_id: ctx.message.message_id });     
    }else{
        glob(__dirname + '/**/arquivos/*.mp4', {}, (err, files)=>{
            if(files.length > 0){
                ctx.replyWithMarkdown('Apagando arquivos!');
                files.forEach(function(value){
                    console.log(value)
                    fs.unlinkSync(value.toString());
                    //ctx.replyWithMarkdown(value+' 👍 Apagado!');
                })
            }else{
                ctx.replyWithMarkdown('👍 Nada para apagar!');
            }
        })
    } 
})
app.on('text', (ctx) => {    
    let chatid = ctx.message.chat.id;
    const isExpired = Date.now() - ctx.session.StartContagem > oneDayInMs;
    let liberado = true;
    if(modo_admin && !Arr_Aut.includes(ctx.update.message.from.id)){
        ctx.reply('❌ ID '+chatid+' não autorizada ❌', { reply_to_message_id: ctx.message.message_id });        
    }else{
        if(ctx.session.Contagem >= LimiteArquivosDia){
            console.log("Limite atingido")
            if(isExpired){
                ctx.session.StartContagem = Date.now();
                ctx.session.Contagem = null;
                liberado = true;     
            }else{
                liberado = false;
                ctx.reply('<b>❗️ Você ultrapassou o limite permitido diário, tente mais tarde</b>', { parse_mode: 'HTML' });    
            }
        }
        if(liberado){
            if(validUrl.isUri(ctx.message.text) && liberado){
                ctx.session.ultimolink = ctx.message.text;
                ctx.reply('Carregando informações, aguarde ', { reply_to_message_id: ctx.message.message_id }) .then((message) => { 
                    pega_info(ctx.message.text,ctx.update.message.from.id,message.message_id,ctx.message.message_id)
                })
                .catch((error) => {
                    console.error('Erro ao enviar a msg:', error);
                });      
            } else {
                ctx.reply('Não parece um URL válida, saiba os sites suportados /url', { reply_to_message_id: ctx.message.message_id });
            }
        } 
    }
})
app.launch()
// Start https webhook
app.telegram.setWebhook('https://SUAURL/secret-path')
app.startWebhook('/secret-path', null, 80)