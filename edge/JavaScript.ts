import * as cp from 'child_process'
import * as glob from 'glob'
import * as _ from 'lodash'
import { fs } from 'mz'
import * as fp from 'path'
import * as ts from 'typescript'
import * as vscode from 'vscode'

import FileInfo from './FileInfo'
import { ExtensionLevelConfigurations, Language, Item, findFilesRoughly, hasFileExtensionOf, tryGetFullPath } from './global'

export interface JavaScriptConfigurations {
	filter: Readonly<{ [key: string]: string }>
}

const SUPPORTED_EXTENSION = /\.(j|t)sx?$/i
const INDEX_FILE_PATTERN = /(\\|\/)index(\.(j|t)sx?)?$/

// Copy from https://mathiasbynens.be/demo/javascript-identifier-regex
// eslint-disable-next-line no-misleading-character-class
const JAVASCRIPT_IDENTIFIER_PATTERN = /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|null|this|true|void|with|await|break|catch|class|const|false|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)(?:[$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D])(?:[$0-9A-Z_a-z\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF])*$/

type PackageJsonPath = string

const getPackageJsonList = _.memoize(async () => {
	const yarnLockPathList = (await vscode.workspace.findFiles('**/yarn.lock', '**/node_modules/**')).map(link => link.fsPath)

	const packageJsonPathList = (await vscode.workspace.findFiles('**/package.json', '**/node_modules/**')).map(link => link.fsPath)

	const packageJsonList: Array<{ packageJsonPath: string, nodeModulePathList: Array<string> }> = []
	for (const packageJsonPath of packageJsonPathList) {
		const nodeModulePathList: Array<string> = []
		for (const yarnLockPath of yarnLockPathList) {
			if (await checkYarnWorkspace(packageJsonPath, yarnLockPath)) {
				nodeModulePathList.push(fp.dirname(yarnLockPath))
			}

			nodeModulePathList.push(fp.dirname(packageJsonPath))
		}

		packageJsonList.push({
			packageJsonPath,
			nodeModulePathList: _.uniq(nodeModulePathList),
		})
	}

	return _.orderBy(packageJsonList, ({ packageJsonPath }) => fp.dirname(packageJsonPath).split(fp.sep).length, 'desc')
})

// Note that the followings are shared with TypeScript language class
const defaultImportCache = new Map<FilePath, string>()
const namespaceImportCache = new Map<FilePath, string>()
const nodeModuleCache = new Map<PackageJsonPath, Array<NodeModuleItem>>()
const fileExtensionExclusion = new Set<string>()
const customImportSyntax = {
	imports: 0,
	requires: 0,
}
const customIndexFile = {
	explicit: 0,
	implicit: 0,
}
const customQuoteCharacters = {
	single: 0,
	double: 0,
}
const customStatementEnding = {
	semi: 0,
	none: 0,
}

export default class JavaScript implements Language {
	private fileCache: Array<FileItem> = []
	private fileIdentifierCache = new Map<FilePath, IdentifierMap>()
	private nodeIdentifierCache = new Map<PackageJsonPath, Array<NodeIdentifierItem>>()

	public configs: JavaScriptConfigurations

	constructor(extensionLevelConfigs: ExtensionLevelConfigurations) {
		this.configs = extensionLevelConfigs.javascript
	}

	async getCompatibleFileExtensions() {
		return ['js', 'jsx']
	}

	async checkIfImportDefaultIsPreferredOverNamespace() {
		return true
	}

	private async setCache(filePath: string) {
		if (/(\\|\/)/.test(filePath) === false) {
			return
		}

		if (SUPPORTED_EXTENSION.test(filePath) === false) {
			this.fileCache.push(new FileItem(filePath))
			return
		}

		const codeTree = await JavaScript.parse(filePath)

		await this.setImportPattern(codeTree)

		this.fileIdentifierCache.delete(filePath)

		const packageJsonList = await getPackageJsonList()
		const packageJsonPath = getClosestPackageJson(filePath, packageJsonList)?.packageJsonPath
		if (packageJsonPath) {
			if (this.nodeIdentifierCache.has(packageJsonPath) === false) {
				this.nodeIdentifierCache.set(packageJsonPath, [])
			}

			const nodeItems = this.nodeIdentifierCache.get(packageJsonPath)
			for (const { identifier, name } of getNamedImportedIdentifiersFromNodeModule(codeTree)) {
				if (nodeItems.some(item => item.identifier === identifier && item.name === name) === false) {
					nodeItems.push(new NodeIdentifierItem(name, identifier))
				}
			}
		}

		for (const [name, { pathList, sourceText }] of await getExportedIdentifiers(codeTree, this.fileIdentifierCache)) {
			if (_.uniq(pathList).length !== 1) {
				continue
			}

			this.fileCache.push(new FileIdentifierItem(filePath, name, sourceText))
		}
	}

	private async setImportPattern(codeTree: ts.SourceFile) {
		if (!codeTree) {
			return
		}

		const quotes = findNodesRecursively<ts.StringLiteral>(codeTree, node => ts.isStringLiteral(node)).map(node => node.getText().trim().charAt(0))
		if (quotes.length > 0) {
			const singleCount = quotes.filter(quote => quote === '\'').length
			customQuoteCharacters.single += singleCount
			customQuoteCharacters.double += quotes.length - singleCount
		}

		const statements = _.chain([codeTree, ...findNodesRecursively<ts.Block>(codeTree, node => ts.isBlock(node))])
			.flatMap(block => Array.from(block.statements))
			.uniq()
			.value()
		if (statements.length > 0) {
			const semiCount = statements.filter(node => node.getText().trim().endsWith(';')).length
			customStatementEnding.semi += semiCount
			customStatementEnding.none += statements.length - semiCount
		}

		const existingImports = getExistingImports(codeTree)
		for (const { node, path } of existingImports) {
			if (ts.isImportDeclaration(node)) {
				customImportSyntax.imports += 1

			} else {
				customImportSyntax.requires += 1
			}

			if (!ts.isImportDeclaration(node) || !node.importClause) {
				continue
			}

			let moduleNameOrFullPath = path
			if (path.startsWith('.')) {
				const fullPath = await tryGetFullPath([fp.dirname(codeTree.fileName), path], fp.extname(codeTree.fileName).replace(/^\./, ''))

				moduleNameOrFullPath = fullPath

				if (SUPPORTED_EXTENSION.test(fullPath)) {
					const fileExtensionWithLeadingDot = fp.extname(fullPath)

					if (INDEX_FILE_PATTERN.test(fullPath)) {
						if (INDEX_FILE_PATTERN.test(path)) {
							customIndexFile.explicit += 1

						} else {
							customIndexFile.implicit += 1
						}

					} else if (path.endsWith(fileExtensionWithLeadingDot) === false) {
						fileExtensionExclusion.add(fileExtensionWithLeadingDot.replace(/^\./, ''))
					}
				}
			}

			if (node.importClause.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
				namespaceImportCache.set(moduleNameOrFullPath, node.importClause.namedBindings.name.text)
				continue
			}

			if (node.importClause.name && ts.isIdentifier(node.importClause.name)) {
				defaultImportCache.set(moduleNameOrFullPath, node.importClause.name.text)
				continue
			}
		}
	}

	private workingThread: Promise<void>
	setItems() {
		if (!this.workingThread) {
			const λ = async () => {
				if (this.fileCache.length === 0) {
					const fileLinks = _.filter(
						await vscode.workspace.findFiles('**/*', '.*' /* Exclude top-level files or directories that start with a period */),
						await this.createLanguageSpecificFileFilter()
					)

					for (const link of fileLinks) {
						await this.setCache(link.fsPath)
					}
				}

				const packageJsonList = await getPackageJsonList()
				for (const { packageJsonPath, nodeModulePathList } of packageJsonList) {
					if (nodeModuleCache.has(packageJsonPath)) {
						continue
					}

					const nodeModuleItems: Array<NodeModuleItem> = []
					nodeModuleCache.set(packageJsonPath, nodeModuleItems)

					const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
					const dependencyNameList = _.chain([packageJson.devDependencies, packageJson.dependencies])
						.map(_.keys)
						.flatten()
						.uniq()
						.value()

					try {
						if (dependencyNameList.some(name => name === '@types/node')) {
							const globalModulePath = cp.execSync('npm list -g', { encoding: 'utf-8' }).split('\n')[0].trim()

							for (const modulePath of _.compact([...nodeModulePathList, globalModulePath])) {
								const nodeJsAPIs = await getNodeJsAPIs(fp.join(modulePath, 'node_modules', '@types/node', 'index.d.ts'))
								if (nodeJsAPIs.length > 0) {
									nodeModuleItems.push(...nodeJsAPIs.map(name => new NodeModuleItem(name)))
									break
								}
							}
						}

					} catch (error) {
						console.error(error)
					}

					for (const name of dependencyNameList) {
						if (name.startsWith('@types/')) {
							continue
						}

						nodeModuleItems.push(new NodeModuleItem(name))
					}

					if (this.nodeIdentifierCache.has(packageJsonPath)) {
						this.nodeIdentifierCache.set(packageJsonPath, this.nodeIdentifierCache.get(packageJsonPath).filter(item => dependencyNameList.includes(item.name)))
					}
				}

				this.workingThread = null
			}

			this.workingThread = λ()
		}

		return this.workingThread
	}

	async getItems(document: vscode.TextDocument) {
		if (hasFileExtensionOf(document, await this.getCompatibleFileExtensions()) === false) {
			return null
		}

		const fileItems = (() => {
			const workPath = _.trimStart(document.fileName.substring(vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath.length).replace(/\\/g, fp.posix.sep), fp.posix.sep)
			const TM_FILENAME_BASE = _.escapeRegExp(fp.basename(document.fileName).replace(/\..+/, ''))

			for (const key in this.configs.filter) {
				const sourceMatcher = new RegExp(key)
				if (sourceMatcher.test(workPath)) {
					// eslint-disable-next-line no-template-curly-in-string
					const targetMatcher = new RegExp(this.configs.filter[key].replace('${TM_FILENAME_BASE}', TM_FILENAME_BASE))
					return this.fileCache.filter(file => targetMatcher.test(file.info.fullPathForPOSIX))
				}
			}

			return this.fileCache
		})()

		const packageJsonList = await getPackageJsonList()
		const packageJsonPath = getClosestPackageJson(document.fileName, packageJsonList)?.packageJsonPath
		const nodeModuleItems = packageJsonPath && nodeModuleCache.get(packageJsonPath) || []
		const nodeIdentifierItems = packageJsonPath && nodeModuleCache.has(packageJsonPath) && this.nodeIdentifierCache.get(packageJsonPath) || []

		return [
			...fileItems,
			...nodeModuleItems,
			...nodeIdentifierItems,
		]
	}

	async addItem(filePath: string) {
		await this.setCache(filePath)

		if (fp.basename(filePath) === 'package.json') {
			await this.setItems()
		}

		await this.setImportPattern(await JavaScript.parse(filePath))
	}

	async cutItem(filePath: string) {
		this.fileIdentifierCache.delete(filePath)

		this.fileCache = this.fileCache.filter(file => file.info.fullPath !== filePath)

		if (fp.basename(filePath) === 'package.json') {
			getPackageJsonList.cache.clear()
			nodeModuleCache.delete(filePath)
		}
	}

	async fixImport(editor: vscode.TextEditor, document: vscode.TextDocument, cancellationToken: vscode.CancellationToken) {
		if (hasFileExtensionOf(document, await this.getCompatibleFileExtensions()) === false) {
			return false
		}

		const documentFileInfo = new FileInfo(document.fileName)
		const rootPath = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath
		const compatibleFileExtensions = _.sortBy(
			await this.getCompatibleFileExtensions(),
			fileExtension => (fileExtension.startsWith(documentFileInfo.fileExtensionWithoutLeadingDot) ? 0 : 1)
		)

		class ImportStatementForFixingImport {
			originalRelativePath: string
			editableRange: vscode.Range
			private matchingFullPaths: Array<string>

			constructor(path: string, start: number, end: number) {
				this.originalRelativePath = path
				this.editableRange = new vscode.Range(document.positionAt(start), document.positionAt(end))
			}

			get quoteChar() {
				const originalText = document.getText(this.editableRange)
				if (originalText.startsWith('\'')) {
					return '\''

				} else {
					return '"'
				}
			}

			async search() {
				if (this.matchingFullPaths === undefined) {
					this.matchingFullPaths = await findFilesRoughly(this.originalRelativePath, compatibleFileExtensions)
				}

				return this.matchingFullPaths
			}
		}

		class FileItemForFixingImport implements vscode.QuickPickItem {
			readonly label: string
			readonly description: string
			readonly fullPath: string

			constructor(fullPath: string) {
				this.fullPath = fullPath
				this.label = fullPath.substring(rootPath.length)
			}
		}

		const codeTree = await JavaScript.parse(document)
		if (!codeTree) {
			return false
		}

		const totalImports = _.flatten([
			codeTree.statements
				.filter(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
				.filter((node: ts.ImportDeclaration) => {
					const path = (node.moduleSpecifier as ts.StringLiteral).text
					return (
						path.startsWith('.') &&
						path.includes('?') === false &&
						path.includes('!') === false &&
						path.includes('"') === false
					)
				})
				.map((node: ts.ImportDeclaration) => new ImportStatementForFixingImport(
					(node.moduleSpecifier as ts.StringLiteral).text,
					node.moduleSpecifier.getStart(),
					node.moduleSpecifier.getEnd()
				)),
			findNodesRecursively<ts.CallExpression>(codeTree, node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]))
				.filter(node => (node.arguments[0] as ts.StringLiteral).text.startsWith('.'))
				.map(node => new ImportStatementForFixingImport(
					(node.arguments[0] as ts.StringLiteral).text,
					node.arguments[0].getStart(),
					node.arguments[0].getEnd()
				)),
		]).filter(item => item.originalRelativePath)

		const getBrokenImports = async () => {
			const imports = await Promise.all(totalImports.map(async stub => {
				if (
					await fs.exists(fp.join(documentFileInfo.directoryPath, stub.originalRelativePath)) === false &&
					await fs.exists(fp.join(documentFileInfo.directoryPath, stub.originalRelativePath + '.' + documentFileInfo.fileExtensionWithoutLeadingDot)) === false
				) {
					return stub
				}
			}))
			return _.compact(imports)
		}
		const brokenImports = await getBrokenImports()

		if (brokenImports.length === 0) {
			vscode.window.setStatusBarMessage('No broken import/require statements have been found.', 5000)
			return null
		}

		const nonResolvableImports: Array<ImportStatementForFixingImport> = []
		const manualSolvableImports: Array<ImportStatementForFixingImport> = []
		for (const item of brokenImports) {
			if (cancellationToken.isCancellationRequested) {
				return null
			}

			const matchingFullPaths = await item.search()
			if (matchingFullPaths.length === 0) {
				nonResolvableImports.push(item)

			} else if (matchingFullPaths.length === 1) {
				const path = await new FileItem(matchingFullPaths[0]).getRelativePath(document)
				await editor.edit(worker => {
					worker.replace(item.editableRange, `${item.quoteChar}${path}${item.quoteChar}`)
				})

			} else {
				manualSolvableImports.push(item)
			}
		}

		for (const item of manualSolvableImports) {
			const matchingFullPaths = await item.search()

			const candidateItems = matchingFullPaths.map(path => new FileItemForFixingImport(path))
			const selectedItem = await vscode.window.showQuickPick(candidateItems, {
				placeHolder: item.originalRelativePath,
				ignoreFocusOut: true,
			})
			if (!selectedItem) {
				return null
			}

			if (cancellationToken.isCancellationRequested) {
				return null
			}

			const path = await new FileItem(selectedItem.fullPath).getRelativePath(document)
			await editor.edit(worker => {
				worker.replace(item.editableRange, `${item.quoteChar}${path}${item.quoteChar}`)
			})
		}

		await JavaScript.fixESLint()

		if (nonResolvableImports.length === 0) {
			vscode.window.setStatusBarMessage('All broken import/require statements have been fixed.', 5000)

		} else {
			vscode.window.showWarningMessage(`There ${nonResolvableImports.length === 1 ? 'was' : 'were'} ${nonResolvableImports.length} broken import/require statement${nonResolvableImports.length === 1 ? '' : 's'} that had not been fixed.`)
		}

		return true
	}

	reset() {
		this.fileCache = []
		this.nodeIdentifierCache.clear()

		nodeModuleCache.clear()
		namespaceImportCache.clear()
		defaultImportCache.clear()
		fileExtensionExclusion.clear()

		for (const custom of [customImportSyntax, customIndexFile, customQuoteCharacters, customStatementEnding] as Array<{ [field: string]: number }>) {
			for (const field in custom) {
				custom[field] = 0
			}
		}

		this.setItems()
	}

	protected async createLanguageSpecificFileFilter() {
		return (link: vscode.Uri) => true
	}

	static async fixESLint() {
		const commands = await vscode.commands.getCommands(true)
		if (commands.indexOf('eslint.executeAutofix') >= 0) {
			await vscode.commands.executeCommand('eslint.executeAutofix')
		}
	}

	static async parse(documentOrFilePath: vscode.TextDocument | string) {
		const filePath = typeof documentOrFilePath === 'string' ? documentOrFilePath : documentOrFilePath.fileName
		if (SUPPORTED_EXTENSION.test(filePath) === false) {
			return null
		}

		try {
			const codeText = typeof documentOrFilePath === 'string' ? await fs.readFile(filePath, 'utf-8') : documentOrFilePath.getText()
			return ts.createSourceFile(filePath, codeText, ts.ScriptTarget.ESNext, true)

		} catch (error) {
			console.error(error)
			return null
		}
	}

	async convertImport(editor: vscode.TextEditor) {
		const document = editor.document

		if (hasFileExtensionOf(document, await this.getCompatibleFileExtensions()) === false) {
			return null
		}

		const codeTree = await JavaScript.parse(document)
		if (!codeTree) {
			return null
		}

		for (const statement of Array.from(codeTree.statements).reverse()) {
			if (!ts.isVariableStatement(statement)) {
				continue
			}

			const importList: Array<string> = []
			let oneOrMoreStatementsAreUnableToConvert = false

			for (const node of statement.declarationList.declarations) {
				if (!node.initializer) {
					oneOrMoreStatementsAreUnableToConvert = true
					break
				}

				let moduleName = node.name.getText().trim()

				let modulePath: string
				if (
					ts.isCallExpression(node.initializer) &&
					ts.isIdentifier(node.initializer.expression) &&
					node.initializer.expression.text === 'require' &&
					node.initializer.arguments.length === 1
				) {
					return

				} else if (
					ts.isPropertyAccessExpression(node.initializer) &&
					ts.isCallExpression(node.initializer.expression) &&
					ts.isIdentifier(node.initializer.expression.expression) &&
					node.initializer.expression.expression.text === 'require' &&
					node.initializer.expression.arguments.length === 1
				) {
					const [firstArgument] = node.initializer.expression.arguments
					if (ts.isStringLiteral(firstArgument)) {
						modulePath = firstArgument.text

						const moduleSuffix = node.initializer.name.text.trim()
						if (moduleSuffix !== 'default' && ts.isObjectBindingPattern(node.name)) {
							if (node.name.elements.length !== 1) {
								oneOrMoreStatementsAreUnableToConvert = true
								break
							}

							const [firstName] = node.name.elements
							if (!ts.isIdentifier(firstName)) {
								oneOrMoreStatementsAreUnableToConvert = true
								break
							}

							moduleName = '{ ' + moduleSuffix + ' as ' + firstName.text.trim() + '}'
						}
					}
				}

				if (!modulePath) {
					oneOrMoreStatementsAreUnableToConvert = true
					break
				}

				// Check if it should write `import * as...` instead of `import default`
				if (moduleName.startsWith('{') === false && document.isUntitled === false && vscode.workspace.getWorkspaceFolder(document.uri)) {
					if (modulePath.startsWith('.')) {
						const fullPath = await tryGetFullPath([fp.dirname(document.fileName), modulePath], _.trimStart(fp.extname(document.fileName), '.'))
						if (fullPath === undefined) {
							continue
						}

						const identifiers = await getExportedIdentifiers(fullPath)
						if (identifiers.has('*default') === false) {
							moduleName = '* as ' + moduleName
						}

					} else if (await this.checkIfImportDefaultIsPreferredOverNamespace() === false) {
						moduleName = '* as ' + moduleName
					}
				}

				importList.push(`import ${moduleName} from '${modulePath}'`)
			}

			if (importList.length === 0 || oneOrMoreStatementsAreUnableToConvert) {
				continue
			}

			const statementEnding = customStatementEnding.semi >= customStatementEnding.none ? ';' : ''

			const lineEnding = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n'

			const importText = importList.join(statementEnding + lineEnding)
			await editor.edit(worker => worker.replace(
				new vscode.Range(document.positionAt(statement.getStart()), document.positionAt(statement.getEnd())),
				importText
			))
		}
	}
}

class FileItem implements Item {
	label: string;
	description: string;
	readonly info: FileInfo

	constructor(filePath: string) {
		this.info = new FileInfo(filePath)

		this.label = this.info.fileNameWithExtension

		const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))
		if (workspace) {
			const workspaceDirectory = workspace.uri.fsPath
			this.description = _.trim(this.info.directoryPath.substring(workspaceDirectory.length), fp.sep)

		} else {
			this.description = this.info.directoryPath
		}
	}

	async addImport(editor: vscode.TextEditor) {
		if (!editor) {
			return null
		}

		const document = editor.document
		if (document.uri.fsPath === this.info.fullPath) {
			vscode.window.showErrorMessage('You cannot import the current active file.', { modal: true })
			return null
		}

		// Save the current active cursor position as the asynchronous operations below might take too long to finish
		const activeCursorPosition = editor.selection.active

		const codeTree = await JavaScript.parse(document)
		if (!codeTree) {
			return null
		}

		const path = await this.getRelativePath(document)

		if (/^(css|less|sass|scss|styl)$/.test(this.info.fileExtensionWithoutLeadingDot)) {
			const existingImports = getExistingImports(codeTree)

			const duplicateImport = getDuplicateImport(existingImports, path)
			if (duplicateImport) {
				vscode.window.showErrorMessage(`The import of "${this.label}" already exists.`, { modal: true })
				focusAt(duplicateImport.node, document)
				return null
			}

			const snippet = await getImportOrRequireSnippet('infer', null, null, path, document)
			await editor.edit(worker => worker.insert(getInsertionPosition(existingImports, path, document), snippet))
			await JavaScript.fixESLint()
			return null
		}

		if (this.info.fileExtensionWithoutLeadingDot === 'json') {
			const autoName = _.words(this.info.fileNameWithoutExtension.replace(/\..+/g, '')).join('')
			const snippet = await getImportOrRequireSnippet('require', 'default', autoName, path, document)
			await editor.edit(worker => worker.insert(activeCursorPosition, snippet))
			await JavaScript.fixESLint()
			return null
		}

		const snippet = await getImportOrRequireSnippet('require', null, null, path, document)
		await editor.edit(worker => worker.insert(activeCursorPosition, snippet))
		await JavaScript.fixESLint()
	}

	async getRelativePath(document: vscode.TextDocument) {
		const directoryPath = new FileInfo(document.fileName).directoryPath
		const path = this.info.getRelativePath(directoryPath)

		// Remove "/index.js" from the path
		if (INDEX_FILE_PATTERN.test(this.info.fullPathForPOSIX) && customIndexFile.implicit > customIndexFile.explicit) {
			return fp.dirname(path)
		}

		// Remove file extension from the path
		if (fileExtensionExclusion.has(this.info.fileExtensionWithoutLeadingDot)) {
			return path.replace(new RegExp(_.escapeRegExp(fp.extname(this.info.fileNameWithExtension)) + '$'), '')
		}

		return path
	}
}

class FileIdentifierItem extends FileItem {
	label: string
	description: string
	detail: string

	readonly name: string
	readonly defaultExported: boolean

	constructor(filePath: string, name: string, text?: string) {
		super(filePath)

		this.name = name

		this.defaultExported = name === '*default'

		if (!this.defaultExported) {
			this.label = name
		}

		this.detail = _.truncate(text, {
			length: 120,
			omission: '...',
		})
	}

	private async getImportPattern(codeTree: ts.SourceFile, document: vscode.TextDocument): Promise<{ name: string, kind: ImportKind, path: string } | null> {
		const indexFilePath = await tryGetFullPath([this.info.directoryPath, 'index'], this.info.fileExtensionWithoutLeadingDot)
		const workingDirectory = fp.dirname(document.fileName)

		const autoName = _.words(this.label.replace(/\..+/g, '')).join('')

		// Try to import from the closest index file
		if (indexFilePath && this.info.fullPath !== indexFilePath && indexFilePath.startsWith(workingDirectory + fp.sep) === false) {
			const indexFile = new FileItem(indexFilePath)
			const existingImports = getExistingImports(codeTree)

			const getDuplicateImportForIndexFile = async () => {
				for (const stub of existingImports) {
					const path = await tryGetFullPath([fp.dirname(indexFilePath), stub.path], this.info.fileExtensionWithoutLeadingDot)
					if (path === indexFilePath) {
						return stub
					}
				}
			}
			const duplicateImportForIndexFile = await getDuplicateImportForIndexFile()
			const duplicateImportHasImportedEverything = (
				duplicateImportForIndexFile &&
				ts.isImportDeclaration(duplicateImportForIndexFile.node) &&
				duplicateImportForIndexFile.node.importClause &&
				ts.isNamespaceImport(duplicateImportForIndexFile.node.importClause.namedBindings)
			)

			// Stop processing if there is `import * as name from "path"`
			if (duplicateImportHasImportedEverything) {
				vscode.window.showErrorMessage(`The import of "${this.label}" already exists through "${duplicateImportForIndexFile.path}".`, { modal: true })
				focusAt(duplicateImportForIndexFile.node, document)
				return null
			}

			const exportedIdentifiersFromIndexFile = await getExportedIdentifiers(indexFilePath)
			for (const [exportedName, { originalName, pathList }] of exportedIdentifiersFromIndexFile) {
				if (_.includes(pathList, this.info.fullPath) === false) {
					continue
				}

				if (originalName !== this.name) {
					continue
				}

				const path = await indexFile.getRelativePath(document)

				if (exportedName === '*default') {
					return {
						name: defaultImportCache.get(indexFile.info.fullPath) || autoName,
						kind: 'default',
						path,
					}
				}

				const namespace = namespaceImportCache.get(indexFile.info.fullPath)
				if (namespace) {
					return {
						name: namespace,
						kind: 'namespace',
						path,
					}
				}

				return {
					name: exportedName,
					kind: 'named',
					path,
				}
			}
		}

		const path = await this.getRelativePath(document)

		if (this.defaultExported) {
			const name = defaultImportCache.get(this.info.fullPath) || autoName
			return {
				name,
				kind: 'default',
				path,
			}
		}

		const namespace = namespaceImportCache.get(this.info.fullPath)
		if (namespace) {
			return {
				name: namespace,
				kind: 'namespace',
				path,
			}

		} else {
			return {
				name: this.name,
				kind: 'named',
				path,
			}
		}
	}

	async addImport(editor: vscode.TextEditor) {
		if (!editor) {
			return null
		}

		const document = editor.document
		if (document.uri.fsPath === this.info.fullPath) {
			vscode.window.showErrorMessage('You cannot import the current active file.', { modal: true })
			return null
		}

		const codeTree = await JavaScript.parse(document)
		if (!codeTree) {
			return null
		}

		const existingImports = getExistingImports(codeTree)

		const { name, kind, path } = await this.getImportPattern(codeTree, document)

		const duplicateImport = getDuplicateImport(existingImports, path)
		if (duplicateImport) {
			// Try merging the given named import with the existing imports
			if (ts.isImportDeclaration(duplicateImport.node) && duplicateImport.node.importClause) {
				// There are 9 cases as a product of 3 by 3 cases:
				// 1) `import default from "path"`
				// 2) `import * as namespace from "path"`
				// 3) `import { named } from "path"`

				if (kind === 'namespace') {
					if (duplicateImport.node.importClause.namedBindings) {
						// Try merging `* as namespace` with `* as namespace`
						// Try merging `* as namespace` with `{ named }`
						vscode.window.showErrorMessage(`The import of "${name}" already exists.`, { modal: true })
						focusAt(duplicateImport.node.importClause.namedBindings, document)
						return null

					} else {
						// Try merging `* as namespace` with `default`
						let givenName = name
						if (duplicateImport.node.importClause.name.text === name) {
							const conflictedIdentifierNode = duplicateImport.node.importClause.name
							const options = [
								{
									title: 'Rename The Default',
									action: async () => {
										// Do not `await` here because it does not work anyway
										vscode.commands.executeCommand('editor.action.rename', [document.uri, document.positionAt(conflictedIdentifierNode.getStart())])
										return name
									},
								},
								{
									title: 'Name The Namespace',
									action: async () => {
										return vscode.window.showInputBox({
											ignoreFocusOut: true,
											value: name,
											validateInput: inputText => (JAVASCRIPT_IDENTIFIER_PATTERN.test(inputText) ? null : 'Not a valid JavaScript identifier.'),
										})
									},
								},
							]
							const selectedOption = await vscode.window.showWarningMessage(`The identifier "${name}" has been used.`, { modal: true }, ...options)
							if (!selectedOption) {
								return null
							}

							givenName = await selectedOption.action()
							if (!givenName) {
								return null
							}
						}

						const position = document.positionAt(duplicateImport.node.importClause.name.getEnd())
						await editor.edit(worker => worker.insert(position, ', * as ' + givenName))
						await JavaScript.fixESLint()
						return null
					}

				} else if (kind === 'named') {
					if (ts.isNamespaceImport(duplicateImport.node.importClause.namedBindings)) {
						// Try merging `{ named }` with `* as namespace`
						const namespaceImport = duplicateImport.node.importClause.namedBindings
						vscode.window.showErrorMessage(`The import of "${path}" already exists as "${namespaceImport.name.text}".`, { modal: true })
						focusAt(namespaceImport, document)
						return null

					} else if (duplicateImport.node.importClause.name) {
						// Try merging `{ named }` with `default`
						const position = document.positionAt(duplicateImport.node.importClause.name.getEnd())
						await editor.edit(worker => worker.insert(position, ', { ' + name + ' }'))
						await JavaScript.fixESLint()
						return null

					} else if (ts.isNamedImports(duplicateImport.node.importClause.namedBindings)) {
						// Try merging `{ named }` with `{ named }`
						if (duplicateImport.node.importClause.namedBindings.elements.some(node => node.name.text === name)) {
							vscode.window.showErrorMessage(`The import of "${name}" already exists.`, { modal: true })
							focusAt(duplicateImport.node, document)
							return null

						} else {
							if (duplicateImport.node.importClause.namedBindings.elements.length > 0) {
								await insertNamedImportToExistingImports(name, duplicateImport.node.importClause.namedBindings.elements, editor)
								await JavaScript.fixESLint()
								return null

							} else {
								// Try merging `{ named }` with `{ }`
								const position = document.positionAt(duplicateImport.node.importClause.namedBindings.getEnd() - 1)
								await editor.edit(worker => worker.insert(position, name))
								await JavaScript.fixESLint()
								return null
							}
						}
					}

				} else if (kind === 'default') { // In case of `import default from "path"`
					if (duplicateImport.node.importClause.name) {
						// Try merging `default` with `default`
						vscode.window.showErrorMessage(`The import of "${name}" already exists.`, { modal: true })
						focusAt(duplicateImport.node, document)
						return null

					} else if (ts.isNamespaceImport(duplicateImport.node.importClause.namedBindings)) {
						// Try merging `default` with `* as namespace`
						let givenName = name
						if (duplicateImport.node.importClause.namedBindings.name.text === name) {
							// Cannot have a rename option here because of adding the identifier at the left side of the renaming position
							givenName = await await vscode.window.showInputBox({
								ignoreFocusOut: true,
								value: name,
								validateInput: inputText => (JAVASCRIPT_IDENTIFIER_PATTERN.test(inputText) ? null : 'Not a valid JavaScript identifier.'),
							})
							if (!givenName) {
								return null
							}
						}

						const position = document.positionAt(duplicateImport.node.importClause.namedBindings.getStart())
						await editor.edit(worker => worker.insert(position, givenName + ', '))
						await JavaScript.fixESLint()
						return null

					} else {
						// Try merging `default` with `{ named }`
						const position = document.positionAt(duplicateImport.node.importClause.namedBindings.getStart())
						await editor.edit(worker => worker.insert(position, name + ', '))
						await JavaScript.fixESLint()
						return null
					}

				} else {
					// In case of an invalid state
					return null
				}

			} else {
				vscode.window.showErrorMessage(`The import of "${name}" already exists.`, { modal: true })
				focusAt(duplicateImport.node, document)
				return null
			}
		}

		const snippet = await getImportOrRequireSnippet('infer', kind, name, path, document)
		await editor.edit(worker => worker.insert(getInsertionPosition(existingImports, path, document), snippet))
		await JavaScript.fixESLint()
	}
}

class NodeModuleItem implements Item {
	readonly name: string
	label: string
	description: string

	constructor(name: string) {
		this.name = name
		this.label = name
	}

	async addImport(editor: vscode.TextEditor, language: JavaScript) {
		return this.addImportInternal(editor, language, undefined)
	}

	protected async addImportInternal(editor: vscode.TextEditor, language: JavaScript, preselectedIdentifier: string | undefined) {
		if (!editor) {
			return null
		}

		const document = editor.document

		const importDefaultIsPreferred = await language.checkIfImportDefaultIsPreferredOverNamespace()
		const typeDefinitions = await this.getTypeDefinitions(document)

		const codeTree = await JavaScript.parse(document)
		if (!codeTree) {
			return null
		}

		const autoName = _.words(_.last(this.name.split('/'))).map(_.upperFirst).join('')

		const existingImports = getExistingImports(codeTree)
		const duplicateImport = existingImports.find(item => item.path === this.name)
		if (duplicateImport) {
			if (
				!preselectedIdentifier && typeDefinitions.length === 0 ||
				!ts.isImportDeclaration(duplicateImport.node) ||
				!duplicateImport.node.importClause ||
				(
					duplicateImport.node.importClause.namedBindings &&
					ts.isNamespaceImport(duplicateImport.node.importClause.namedBindings)
				)
			) {
				vscode.window.showErrorMessage(`The import of "${this.name}" already exists.`, { modal: true })
				focusAt(duplicateImport.node, document)
				return null
			}

			const selectedIdentifier = preselectedIdentifier || await vscode.window.showQuickPick([
				...(importDefaultIsPreferred ? ['default'] : []),
				...typeDefinitions,
			])
			if (!selectedIdentifier) {
				return null
			}

			if (selectedIdentifier === 'default') {
				if (duplicateImport.node.importClause.name) {
					// Try merging `default` with `default`
					vscode.window.showErrorMessage(`The import of "${this.name}" already exists.`, { modal: true })
					focusAt(duplicateImport.node, document)
					return null

				} else if (duplicateImport.node.importClause.namedBindings && ts.isNamedImports(duplicateImport.node.importClause.namedBindings)) {
					// Try merging `default` with `{ named }`
					const position = document.positionAt(duplicateImport.node.importClause.namedBindings.getStart())
					await editor.edit(worker => worker.insert(position, (defaultImportCache.get(this.name) || autoName) + ', '))
					await JavaScript.fixESLint()
					return null
				}

			} else {
				if (duplicateImport.node.importClause.namedBindings && ts.isNamedImports(duplicateImport.node.importClause.namedBindings)) {
					// Try merging `{ named }` with `{ named }`
					if (duplicateImport.node.importClause.namedBindings.elements.some(node => node.name.text === selectedIdentifier)) {
						vscode.window.showErrorMessage(`The import of "${selectedIdentifier}" already exists.`, { modal: true })
						focusAt(duplicateImport.node, document)
						return

					} else {
						if (duplicateImport.node.importClause.namedBindings.elements.length > 0) {
							await insertNamedImportToExistingImports(selectedIdentifier, duplicateImport.node.importClause.namedBindings.elements, editor)
							await JavaScript.fixESLint()
							return

						} else {
							// Try merging `{ named }` with `{ }`
							const position = document.positionAt(duplicateImport.node.importClause.namedBindings.getEnd() - 1)
							await editor.edit(worker => worker.insert(position, selectedIdentifier))
							await JavaScript.fixESLint()
							return null
						}
					}

				} else if (duplicateImport.node.importClause.name) {
					// Try merging `{ named }` with `default`
					const position = document.positionAt(duplicateImport.node.importClause.name.getEnd())
					await editor.edit(worker => worker.insert(position, ', { ' + selectedIdentifier + ' }'))
					await JavaScript.fixESLint()
					return null
				}
			}
		}

		let kind: ImportKind = null
		let name = autoName
		if (preselectedIdentifier) {
			kind = 'named'
			name = preselectedIdentifier

		} else if (typeDefinitions.length === 0) {
			if (importDefaultIsPreferred) {
				kind = 'default'
				name = defaultImportCache.get(this.name) || autoName

			} else {
				kind = 'namespace'
				name = namespaceImportCache.get(this.name) || autoName
			}

		} else {
			const select = await vscode.window.showQuickPick([
				importDefaultIsPreferred ? 'default' : '*',
				...typeDefinitions,
			])
			if (!select) {
				return null
			}

			if (select === 'default') {
				kind = 'default'
				name = defaultImportCache.get(this.name) || autoName

			} else if (select === '*') {
				kind = 'namespace'
				name = namespaceImportCache.get(this.name) || autoName

			} else {
				kind = 'named'
				name = select
			}
		}

		const snippet = await getImportOrRequireSnippet('infer', kind, name, this.name, document)
		await editor.edit(worker => worker.insert(getInsertionPosition(existingImports, this.name, document), snippet))
		await JavaScript.fixESLint()
	}

	private async getTypeDefinitions(document: vscode.TextDocument) {
		const packageJsonList = await getPackageJsonList()
		const packageJson = getClosestPackageJson(document.fileName, packageJsonList)
		if (!packageJson || !packageJson.nodeModulePathList) {
			return []
		}

		const Φ = async () => {
			// Traverse through the deepest `node_modules` first
			for (const rootPath of _.sortBy(packageJson.nodeModulePathList).reverse()) {
				const packageJsonPath = fp.join(rootPath, 'node_modules', this.name, 'package.json')
				if (await fs.exists(packageJsonPath)) {
					try {
						const { typings } = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
						if (_.isString(typings)) {
							const typeDefinitionPath = fp.resolve(fp.dirname(packageJsonPath), typings)
							if (await fs.exists(typeDefinitionPath)) {
								return typeDefinitionPath
							}
						}

					} catch (error) {
						// Do nothing
					}
				}

				const typeDefinitionPath = fp.join(rootPath, 'node_modules', '@types/' + this.name, 'index.d.ts')
				if (await fs.exists(typeDefinitionPath)) {
					return typeDefinitionPath
				}
			}
		}

		const typeDefinitionPath = await Φ()
		if (typeDefinitionPath === undefined) {
			return []
		}

		try {
			const codeTree = await JavaScript.parse(typeDefinitionPath)
			const typeDefinitions: Array<string> = []

			let globallyExportedIdentifier: string = null
			codeTree.forEachChild(node => {
				if (ts.isModuleDeclaration(node) && node.name.text === this.name && node.body && ts.isModuleBlock(node.body)) {
					// Find `declare module '???' { ... }` where ??? is the module name
					node.body.forEachChild(node => {
						if (node.modifiers && node.modifiers.some(node => node.kind === ts.SyntaxKind.ExportKeyword) && (node as any).name) {
							// Gather all `export` members
							typeDefinitions.push((node as any).name.text)
						}
					})

				} else if (ts.isNamespaceExportDeclaration(node)) {
					// Find `export as namespace ???`
					globallyExportedIdentifier = node.name.text
				}
			})

			if (globallyExportedIdentifier) {
				// Gather all members inside `declare namespace ??? { ... }`
				findNodesRecursively<ts.ModuleDeclaration>(codeTree, node => (
					ts.isModuleDeclaration(node) &&
					node.modifiers &&
					node.modifiers.some(node => node.kind === ts.SyntaxKind.DeclareKeyword) &&
					node.name.text === globallyExportedIdentifier &&
					node.body &&
					ts.isModuleBlock(node.body)
				)).forEach(({ body }) => {
					body.forEachChild((node: any) => {
						if (ts.isVariableStatement(node)) {
							for (const stub of node.declarationList.declarations) {
								if (ts.isVariableDeclaration(stub) && ts.isIdentifier(stub.name)) {
									typeDefinitions.push(stub.name.text)
								}
							}

						} else if (node.name) {
							typeDefinitions.push(node.name.text)
						}
					})
				})
			}

			return _.chain(typeDefinitions).compact().uniq().sortBy().value()

		} catch (error) {
			return []
		}
	}
}

class NodeIdentifierItem extends NodeModuleItem {
	readonly identifier: string

	constructor(name: string, identifier: string) {
		super(name)

		this.identifier = identifier
		this.label = identifier
		this.description = name
	}

	async addImport(editor: vscode.TextEditor, language: JavaScript) {
		return super.addImportInternal(editor, language, this.identifier)
	}
}

function getRequirePath(node: ts.Node) {
	if (node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1) {
		const firstArgument = node.arguments[0]
		if (ts.isStringLiteral(firstArgument)) {
			return firstArgument.text
		}
	}
}

interface ImportStatementForReadOnly {
	node: ts.ImportDeclaration | ts.VariableStatement | ts.ExpressionStatement
	path: string
}

function getExistingImports(codeTree: ts.SourceFile) {
	const imports: Array<ImportStatementForReadOnly> = []

	codeTree.forEachChild(node => {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			// For `import '...'`
			//     `import name from '...'`
			//     `import { name } from '...'`
			imports.push({
				node,
				path: _.trimEnd(node.moduleSpecifier.text, '/'),
			})

		} else if (ts.isVariableStatement(node)) {
			// For `var name = require('...')`
			//     `var { name } = require('...')`
			node.declarationList.declarations.forEach(stub => {
				if (ts.isVariableDeclaration(stub) && stub.initializer && getRequirePath(stub.initializer)) {
					imports.push({
						node,
						path: getRequirePath(stub.initializer),
					})
				}
			})

		} else if (ts.isExpressionStatement(node) && getRequirePath(node.expression)) {
			// For `require('...')`
			imports.push({
				node,
				path: getRequirePath(node.expression),
			})
		}
	})

	return imports
}

async function insertNamedImportToExistingImports(name: string, existingImports: ts.NodeArray<ts.ImportSpecifier>, editor: vscode.TextEditor) {
	const { document } = editor
	const lineEnding = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n'

	for (let index = 0; index < existingImports.length; index++) {
		if (name > existingImports[index].name.text) {
			continue
		}

		let separator = ', '
		const [prevImportLineNumber, thisImportLineNumber, nextImportLineNumber] =
			[existingImports[index - 1], existingImports[index], existingImports[index + 1]].map(item => (item ? document.positionAt(item.getStart()).line : null))
		if (
			nextImportLineNumber !== null && thisImportLineNumber !== nextImportLineNumber ||
			prevImportLineNumber !== null && prevImportLineNumber !== thisImportLineNumber
		) {
			separator = ',' + lineEnding + document.lineAt(thisImportLineNumber).text.match(/^(\s|\t)*/)[0]
		}

		const position = document.positionAt(existingImports[index].getStart())
		await editor.edit(worker => worker.insert(position, name + separator))
		return
	}

	let separator = ', '
	if (existingImports.length > 1) {
		const lastImportLineNumber = document.positionAt(existingImports[existingImports.length - 1].getStart()).line
		const prevImportLineNumber = document.positionAt(existingImports[existingImports.length - 2].getStart()).line
		if (lastImportLineNumber !== prevImportLineNumber) {
			separator = ',' + lineEnding + document.lineAt(lastImportLineNumber).text.match(/^(\s|\t)*/)[0]
		}
	}

	const position = document.positionAt(existingImports[existingImports.length - 1].getEnd())
	await editor.edit(worker => worker.insert(position, separator + name))
}

type ImportKind = 'default' | 'namespace' | 'named' | null

async function getImportOrRequireSnippet(syntax: 'import' | 'require' | 'infer', kind: ImportKind, name: string | null, path: string, document: vscode.TextDocument) {
	const quote = customQuoteCharacters.single >= customQuoteCharacters.double ? '\'' : '"'

	const statementEnding = customStatementEnding.semi >= customStatementEnding.none ? ';' : ''

	const lineEnding = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n'

	if (/^typescript(react)?$/.test(document.languageId)) {
		syntax = 'import'
	}

	if (syntax === 'import' || syntax === 'infer' && customImportSyntax.imports > customImportSyntax.requires) {
		if (!kind || !name) {
			return `import ${quote}${path}${quote}` + statementEnding + lineEnding

		} else if (kind === 'default') {
			return `import ${name} from ${quote}${path}${quote}` + statementEnding + lineEnding

		} else if (kind === 'namespace') {
			return `import * as ${name} from ${quote}${path}${quote}` + statementEnding + lineEnding

		} else if (kind === 'named') {
			return `import { ${name} } from ${quote}${path}${quote}` + statementEnding + lineEnding
		}

	} else {
		if (kind === null || !name) {
			return `require(${quote}${path}${quote})`

		} else if (kind === 'named') {
			return `const { ${name} } = require(${quote}${path}${quote})` + statementEnding + lineEnding

		} else {
			return `const ${name} = require(${quote}${path}${quote})` + statementEnding + lineEnding
		}
	}
}

type FilePath = string
type IdentifierName = string
interface IdentifierMap extends Map<IdentifierName, { originalName?: string, sourceText: string, pathList: Array<string> }> { }

function δ(name: string) {
	return name === 'default' ? '*default' : name
}

async function getExportedIdentifiers(filePathOrCodeTree: string | ts.SourceFile, cachedFilePaths = new Map<FilePath, IdentifierMap>(), processingFilePaths = new Set<string>()) {
	const exportedNames: IdentifierMap = new Map()

	if (!filePathOrCodeTree) {
		return exportedNames
	}

	const filePath = typeof filePathOrCodeTree === 'string' ? filePathOrCodeTree : filePathOrCodeTree.fileName.replace(/\//g, fp.sep)

	if (cachedFilePaths.has(filePath)) {
		return cachedFilePaths.get(filePath)
	}

	// Prevent looping indefinitely because of a cyclic dependency
	if (processingFilePaths.has(filePath)) {
		return exportedNames

	} else {
		processingFilePaths.add(filePath)
	}

	const codeTree = typeof filePathOrCodeTree === 'string' ? await JavaScript.parse(filePath) : filePathOrCodeTree
	if (!codeTree) {
		return exportedNames
	}

	const fileDirectory = fp.dirname(filePath)
	const fileExtension = _.trimStart(fp.extname(filePath), '.')

	const importedNames: IdentifierMap = new Map()

	try {
		for (const node of codeTree.statements) {
			if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
				if (/^[./]/.test(node.moduleSpecifier.text) === false) {
					continue
				}

				const path = await tryGetFullPath([fileDirectory, node.moduleSpecifier.text], fileExtension)
				if (!path) {
					continue
				}

				const transitIdentifiers = await getExportedIdentifiers(path, cachedFilePaths, processingFilePaths)

				if (node.importClause.name) {
					// Example:
					// import named from "path"
					if (transitIdentifiers.has('*default')) {
						const { sourceText, pathList } = transitIdentifiers.get('*default')
						importedNames.set(node.importClause.name.text, {
							originalName: '*default',
							sourceText,
							pathList: [path, ...pathList],
						})
					}
				}

				if (node.importClause.namedBindings) {
					if (ts.isNamedImports(node.importClause.namedBindings)) {
						// Example:
						// import { named } from "path"
						for (const stub of node.importClause.namedBindings.elements) {
							const name = stub.name.text
							if (transitIdentifiers.has(name)) {
								const { sourceText, pathList } = transitIdentifiers.get(name)
								importedNames.set(name, {
									originalName: name,
									sourceText,
									pathList: [path, ...pathList],
								})
							}
						}

					} else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
						// Example:
						// import * as namespace from "path"
						// TODO: find the correct text by tracing `Namespace.Named`
						importedNames.set(node.importClause.namedBindings.name.text, {
							sourceText: node.getText(),
							pathList: [path],
						})
					}
				}

			} else if (ts.isExportDeclaration(node)) {
				const path = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) &&
					await tryGetFullPath([fileDirectory, node.moduleSpecifier.text], fileExtension)

				if (node.exportClause) {
					for (const stub of node.exportClause.elements) {
						const name = stub.name.text
						if (path) {
							const transitIdentifiers = await getExportedIdentifiers(path, cachedFilePaths, processingFilePaths)
							if (stub.propertyName && transitIdentifiers.has(δ(stub.propertyName.text))) {
								// Example:
								// export { named as exported } from "path"
								const { originalName, sourceText, pathList } = transitIdentifiers.get(δ(stub.propertyName.text))
								exportedNames.set(name, {
									originalName,
									sourceText,
									pathList: [filePath, path, ...pathList],
								})

							} else if (transitIdentifiers.has(name)) {
								// Example:
								// export { named } from "path"
								const { originalName, sourceText, pathList } = transitIdentifiers.get(name)
								exportedNames.set(name, {
									originalName,
									sourceText,
									pathList: [filePath, path, ...pathList],
								})
							}

						} else {
							if (stub.propertyName && importedNames.has(stub.propertyName.text)) {
								// Example:
								// export { named as exported }
								const { originalName, sourceText, pathList } = importedNames.get(stub.propertyName.text)
								exportedNames.set(name, {
									originalName,
									sourceText,
									pathList: [filePath, ...pathList],
								})

							} else if (importedNames.has(name)) {
								// Example:
								// import named from "path"
								// export { named }
								const { originalName, sourceText, pathList } = importedNames.get(name)
								exportedNames.set(name, {
									originalName,
									sourceText,
									pathList: [filePath, ...pathList],
								})

							} else {
								// Example:
								// const named = ...
								// export { named }
								exportedNames.set(name, {
									originalName: name,
									sourceText: '',
									pathList: [filePath],
								})
							}
						}
					}

				} else {
					// Example:
					// export * from "path"
					const transitIdentifiers = await getExportedIdentifiers(path, cachedFilePaths, processingFilePaths)
					transitIdentifiers.forEach(({ originalName, sourceText, pathList }, name) => {
						exportedNames.set(name, {
							originalName,
							sourceText,
							pathList: [filePath, ...pathList],
						})
					})
				}

			} else if (ts.isExportAssignment(node)) {
				if (ts.isIdentifier(node.expression)) {
					// Example:
					// export default named
					const name = node.expression.text
					if (importedNames.has(name)) {
						const { originalName, sourceText, pathList } = importedNames.get(name)
						exportedNames.set('*default', {
							originalName,
							sourceText,
							pathList: [filePath, ...pathList],
						})

					} else {
						exportedNames.set('*default', {
							originalName: name,
							sourceText: node.getText(),
							pathList: [filePath],
						})
					}

				} else {
					// Example:
					// export default {}
					exportedNames.set('*default', {
						sourceText: node.getText(),
						pathList: [filePath],
					})
				}

			} else if (
				(ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) &&
				node.modifiers && node.modifiers.length > 0 && node.modifiers[0].kind === ts.SyntaxKind.ExportKeyword
			) {
				if (node.modifiers.length > 1 && node.modifiers[1].kind === ts.SyntaxKind.DefaultKeyword) {
					// Example:
					// export default function () {}
					// export default function named () {}
					if (ts.isFunctionDeclaration(node) && node.name) {
						exportedNames.set('*default', {
							originalName: node.name.text,
							sourceText: node.getText(),
							pathList: [filePath],
						})

					} else {
						exportedNames.set('*default', {
							sourceText: node.getText(),
							pathList: [filePath],
						})
					}

				} else if (node.name) {
					// Example:
					// export function named () {}
					// export class named {}
					// export interface named {}
					// export type named = ...
					// export enum named = ...
					exportedNames.set(node.name.text, {
						originalName: node.name.text,
						sourceText: node.getText(),
						pathList: [filePath],
					})
				}

			} else if (
				ts.isVariableStatement(node) &&
				node.modifiers && node.modifiers.length > 0 && node.modifiers[0].kind === ts.SyntaxKind.ExportKeyword
			) {
				// Example:
				// export const named = ...
				node.declarationList.declarations.forEach(stub => {
					if (ts.isIdentifier(stub.name)) {
						exportedNames.set(stub.name.text, {
							originalName: stub.name.text,
							sourceText: node.getText(),
							pathList: [filePath],
						})
					}
				})

			} else if (
				ts.isExpressionStatement(node) &&
				ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
				ts.isPropertyAccessExpression(node.expression.left) &&
				ts.isIdentifier(node.expression.left.expression) && node.expression.left.expression.text === 'module' && node.expression.left.name.text === 'exports'
			) {
				// Example:
				// module.exports = ...
				if (ts.isIdentifier(node.expression.right)) {
					const name = node.expression.right.text
					if (importedNames.has(name)) {
						const { originalName, sourceText, pathList } = importedNames.get(name)
						exportedNames.set('*default', {
							originalName,
							sourceText,
							pathList: [filePath, ...pathList],
						})

					} else {
						exportedNames.set('*default', {
							originalName: name,
							sourceText: node.getText(),
							pathList: [filePath],
						})
					}

				} else {
					exportedNames.set('*default', {
						sourceText: node.getText(),
						pathList: [filePath],
					})
				}

			} else if (
				ts.isExpressionStatement(node) &&
				ts.isBinaryExpression(node.expression) &&
				ts.isPropertyAccessExpression(node.expression.left) &&
				ts.isPropertyAccessExpression(node.expression.left.expression) &&
				ts.isIdentifier(node.expression.left.expression.expression) &&
				node.expression.left.expression.expression.text === 'module' &&
				ts.isIdentifier(node.expression.left.expression.name) &&
				node.expression.left.expression.name.text === 'exports'
			) {
				// Example:
				// module.exports.named = ...
				if (ts.isIdentifier(node.expression.right)) {
					const name = node.expression.right.text
					if (importedNames.has(name)) {
						const { originalName, sourceText, pathList } = importedNames.get(name)
						exportedNames.set(node.expression.left.name.text, {
							originalName,
							sourceText,
							pathList: [filePath, ...pathList],
						})

					} else {
						exportedNames.set(node.expression.left.name.text, {
							originalName: name,
							sourceText: node.getText(),
							pathList: [filePath],
						})
					}

				} else {
					exportedNames.set(node.expression.left.name.text, {
						sourceText: node.getText(),
						pathList: [filePath],
					})
				}
			}
		}

	} catch (error) {
		console.error(error)
	}

	if (cachedFilePaths.has(filePath) === false) {
		cachedFilePaths.set(filePath, exportedNames)
	}

	processingFilePaths.delete(filePath)

	return exportedNames
}

function getNamedImportedIdentifiersFromNodeModule(codeTree: ts.SourceFile) {
	return _.chain(getExistingImports(codeTree))
		.reject(({ path }) => path.startsWith('.') || path.startsWith('!'))
		.flatMap(({ node, path }) => {
			if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
				return node.importClause.namedBindings.elements.map(stub => {
					return {
						identifier: stub.name.text,
						name: path,
					}
				})
			}

			if (ts.isVariableStatement(node)) {
				return _.flatMap(node.declarationList.declarations, stub => {
					if (ts.isObjectBindingPattern(stub)) {
						return stub.elements.map(item => {
							if (ts.isIdentifier(item.propertyName)) {
								return {
									identifier: item.propertyName.text,
									name: path,
								}

							} else if (ts.isIdentifier(item.name)) {
								return {
									identifier: item.name.text,
									name: path,
								}
							}
						})
					}
				})
			}
		})
		.compact()
		.value()
}

function getDuplicateImport(existingImports: Array<ImportStatementForReadOnly>, path: string) {
	return existingImports.find(stub => stub.path === path)
}

function getInsertionPosition(existingImports: Array<ImportStatementForReadOnly>, path: string, document: vscode.TextDocument) {
	if (existingImports.length > 0) {
		if (path.startsWith('.')) {
			const fileImportList = existingImports.filter(stub => stub.path.startsWith('.'))
			const targetImport = _.findLast(fileImportList, stub => stub.path.localeCompare(path) === -1)
			if (targetImport) {
				return document.positionAt(targetImport.node.getEnd()).translate({ lineDelta: +1 }).with({ character: 0 })

			} else if (fileImportList.length > 0) {
				return document.positionAt(_.last(fileImportList).node.getEnd()).translate({ lineDelta: +1 }).with({ character: 0 })

			} else {
				return document.positionAt(_.last(existingImports).node.getEnd()).translate({ lineDelta: +1 }).with({ character: 0 })
			}

		} else {
			const nodeImportList = existingImports.filter(stub => stub.path.startsWith('.') === false)
			const targetImport = _.findLast(nodeImportList, stub => stub.path.localeCompare(path) === -1)
			if (targetImport) {
				return document.positionAt(targetImport.node.getEnd()).translate({ lineDelta: +1 }).with({ character: 0 })

			} else if (nodeImportList.length > 0) {
				return document.positionAt(_.first(nodeImportList).node.getStart())

			} else {
				return document.positionAt(_.first(existingImports).node.getStart())
			}
		}
	}

	return new vscode.Position(0, 0)
}

function findNodesRecursively<T extends ts.Node>(node: ts.Node, condition: (node: ts.Node) => boolean, results: Array<T> = [], visited = new Set<ts.Node>()) {
	if (node === null || node === undefined) {
		return results
	}

	if (visited.has(node)) {
		return results

	} else {
		visited.add(node)
	}

	if (condition(node)) {
		results.push(node as T)
		return results

	} else {
		node.forEachChild(stub => {
			findNodesRecursively(stub, condition, results, visited)
		})
	}

	return results
}

function focusAt(node: { getStart: () => number, getEnd: () => number }, document: vscode.TextDocument) {
	const editor = vscode.window.activeTextEditor
	if (!editor) {
		return
	}

	editor.revealRange(
		new vscode.Range(
			document.positionAt(node.getStart()),
			document.positionAt(node.getEnd())
		),
		vscode.TextEditorRevealType.InCenterIfOutsideViewport
	)
}

async function getNodeJsAPIs(typeDefinitionPath: string): Promise<Array<string>> {
	const codeTree = await JavaScript.parse(typeDefinitionPath)
	if (!codeTree) {
		return []
	}

	const fromOtherFiles = _.flatten(await Promise.all(codeTree.referencedFiles.map(({ fileName }) => getNodeJsAPIs(fp.join(fp.dirname(typeDefinitionPath), fileName)))))

	return _.chain(codeTree.statements)
		.map(node => {
			if (
				ts.isModuleDeclaration(node) &&
				node.modifiers && node.modifiers.length > 0 &&
				node.modifiers[0].kind === ts.SyntaxKind.DeclareKeyword &&
				(ts.isStringLiteral(node.name) || ts.isIdentifier(node.name))
			) {
				// Return XXX in `declare module "XXX" { ... }`
				return node.name.text
			}
		})
		.union(fromOtherFiles)
		.compact()
		.difference(['NodeJS', 'setTimeout', 'setImmediate'])
		.value()
}

function getClosestPackageJson<T extends { packageJsonPath: string }>(filePath: string, packageJsonList: Array<T>) {
	return packageJsonList.find(({ packageJsonPath }) => filePath.startsWith(fp.dirname(packageJsonPath) + fp.sep))
}

// Copy from https://github.com/ThisIsManta/vscode-package-watch/blob/master/edge/extension.ts
async function checkYarnWorkspace(packageJsonPath: string, yarnLockPath: string) {
	if (!packageJsonPath || !yarnLockPath) {
		return false
	}

	// See https://yarnpkg.com/lang/en/docs/workspaces/
	const packageJsonForYarnWorkspace = JSON.parse(await fs.readFile(fp.join(fp.dirname(yarnLockPath), 'package.json'), 'utf-8')) as { private?: boolean, workspaces?: Array<string> }
	if (!packageJsonForYarnWorkspace || packageJsonForYarnWorkspace.private !== true || !packageJsonForYarnWorkspace.workspaces) {
		return false
	}

	const yarnWorkspacePathList = _.chain(packageJsonForYarnWorkspace.workspaces)
		.map(pathOrGlob => glob.sync(pathOrGlob, {
			cwd: fp.dirname(yarnLockPath),
			absolute: true,
		}))
		.flatten()
		.map(path => path.replace(/\//g, fp.sep))
		.value()
	if (_.includes(yarnWorkspacePathList, fp.dirname(packageJsonPath))) {
		return true
	}

	return false
}
